import type { IFCAU_API } from '@dongdev/fca-unofficial';
import login from '@dongdev/fca-unofficial';
import * as fs from 'fs';
import { APPSTATE_PATH, LOGIN_CREDENTIALS, config } from './config';
import { handleEvent } from './handlers';
import { loadCommands } from './loader';
import { logger } from './utils/logger';
import { Threads } from '../database/controllers/threadController';

const BASE_RETRY_MS = 5_000;
const MAX_RETRY_MS = 5 * 60_000;

type ThreadSummary = { threadID: string; name?: string };

const THREAD_TAGS: ReadonlyArray<'INBOX' | 'OTHER' | 'PENDING' | 'ARCHIVED'> = ['INBOX', 'OTHER', 'PENDING', 'ARCHIVED'];

// Helper: fetch all group threads with pagination across all tags
const getGroupThreads = async (api: IFCAU_API, pageSize = 25, maxPagesPerTag = 10): Promise<ThreadSummary[]> => {
  const seen = new Set<string>();
  const results: ThreadSummary[] = [];

  for (const tag of THREAD_TAGS) {
    let cursor: number | null = null;

    for (let page = 0; page < maxPagesPerTag; page++) {
      const batch = await new Promise<any[]>((resolve, reject) => {
        api.getThreadList(pageSize, cursor, [tag], (err, threads) => {
          if (err) return reject(err);
          resolve(threads || []);
        });
      });

      if (!batch.length) break;

      for (const raw of batch) {
        if (!raw?.isGroup) continue;
        const id = String(raw.threadID || raw.thread_id || '');
        if (!id || seen.has(id)) continue;

        seen.add(id);
        results.push({ threadID: id, name: raw.name });
      }

      if (batch.length < pageSize) break;

      const last = batch[batch.length - 1] as any;
      const nextCursor = Number(last?.timestamp ?? last?.lastMessageTimestamp ?? last?.messageCount);
      if (!Number.isFinite(nextCursor)) break;
      cursor = nextCursor;
    }
  }

  return results;
};

// Helper: get thread info with participants
const getThreadInfoSafe = (api: IFCAU_API, threadID: string): Promise<any | null> => {
  return new Promise((resolve) => {
    api.getThreadInfo(threadID, (err: Error | null, info: any) => {
      if (err || !info) return resolve(null);
      resolve(info);
    });
  });
};

// Helper: remove a member and optionally notify the group
const removeMember = (api: IFCAU_API, threadID: string, userID: string, reason: string): Promise<void> => {
  return new Promise((resolve) => {
    api.removeUserFromGroup(userID, threadID, (err) => {
      if (err) {
        logger.warn(`Startup ban scan: failed to kick ${userID} in ${threadID}:`, err);
        return resolve();
      }

      api.sendMessage(`🚫 Auto-kick: ${userID} is banned. ${reason}`, threadID, () => resolve());
    });
  });
};

// Helper: fetch user display name for nicer messages
const getUserName = (api: IFCAU_API, userID: string): Promise<string> => {
  return new Promise((resolve) => {
    api.getUserInfo([userID], (err: Error | null, info: Record<string, { name?: string }> | null) => {
      if (err || !info) return resolve(userID);
      resolve(info[userID]?.name || userID);
    });
  });
};

const refreshBanState = async (threadID: string): Promise<{ banned: Set<string>; tempBans: Record<string, number>; now: number }> => {
  const threadData = await Threads.getData(threadID);

  let bannedUsers: string[] = [];
  try {
    bannedUsers = JSON.parse(threadData.bannedUsers || '[]').map((id: any) => String(id));
  } catch {
    bannedUsers = [];
  }

  const settings = await Threads.getSettings(threadID);
  const rawTempBans = (settings as any).tempBans || {};
  const now = Date.now();
  const tempBans: Record<string, number> = {};
  let changed = false;

  for (const [id, until] of Object.entries(rawTempBans)) {
    if (typeof until === 'number' && until > now) {
      tempBans[id] = until;
    } else {
      changed = true;
    }
  }

  if (changed) {
    (settings as any).tempBans = tempBans;
    await Threads.setSettings(threadID, settings);
  }

  return { banned: new Set(bannedUsers), tempBans, now };
};

const enforceBansInThread = async (api: IFCAU_API, threadID: string, participantIDs: string[]): Promise<void> => {
  const { banned, tempBans, now } = await refreshBanState(threadID);
  const selfID = String(api.getCurrentUserID());

  if (banned.size === 0 && Object.keys(tempBans).length === 0) return;

  for (const rawID of participantIDs) {
    const userID = String(rawID || '');
    if (!userID || userID === selfID) continue;

    if (banned.has(userID)) {
      const name = await getUserName(api, userID);
      await removeMember(api, threadID, userID, `${name} is permanently banned.`);
      continue;
    }

    const until = tempBans[userID];
    if (until && until > now) {
      const minutesLeft = Math.max(1, Math.ceil((until - now) / (60 * 1000)));
      const name = await getUserName(api, userID);
      await removeMember(api, threadID, userID, `${name} is temporarily banned (${minutesLeft} minute(s) remaining).`);
    }
  }
};

const startupBanScan = async (api: IFCAU_API): Promise<void> => {
  try {
    logger.info('Startup ban scan: fetching group list...');
    const groups = await getGroupThreads(api);

    logger.info(`Startup ban scan: checking ${groups.length} group(s)`);

    for (const group of groups) {
      const threadID = String(group.threadID || group.thread_id || '');
      if (!threadID) continue;

      const info = await getThreadInfoSafe(api, threadID);
      const participantIDs = info?.participantIDs || [];
      if (!participantIDs.length) {
        logger.warn(`Startup ban scan: no participants returned for ${threadID} (${group.name || 'unknown'})`);
        continue;
      }

      await enforceBansInThread(api, threadID, participantIDs);
    }

    logger.info('Startup ban scan completed.');
  } catch (error) {
    logger.warn('Startup ban scan failed:', error);
  }
};

const isLikelyAppState = (value: unknown): value is unknown[] => {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      cookie => typeof cookie === 'object' && cookie !== null && 'key' in cookie && 'value' in cookie,
    )
  );
};

const readAppState = (): unknown[] | null => {
  if (!fs.existsSync(APPSTATE_PATH)) {
    logger.warn('appstate.json not found; will attempt credential login if configured.');
    return null;
  }

  try {
    const raw = fs.readFileSync(APPSTATE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || (Array.isArray(parsed) && parsed.length === 0)) {
      logger.warn('appstate.json is empty. Please add cookies for the bot to work.');
      return null;
    }

    if (!isLikelyAppState(parsed)) {
      logger.warn('appstate.json does not look like valid appstate cookies. Clearing file and falling back.');
      fs.writeFileSync(APPSTATE_PATH, '[]');
      return null;
    }

    return parsed;
  } catch (error) {
    logger.error('appstate.json has invalid JSON format. Resetting to empty.', error);
    fs.writeFileSync(APPSTATE_PATH, '[]');
    return null;
  }
};

export const startBot = (): void => {
  loadCommands();

  let reconnectTimer: NodeJS.Timeout | null = null;
  let reconnectAttempts = 0;
  let stopListening: (() => void) | undefined;

  const clearExistingListener = (): void => {
    if (stopListening) {
      try {
        stopListening();
      } catch (error) {
        logger.warn('Error while stopping previous listener', error);
      }
      stopListening = undefined;
    }
  };

  const scheduleReconnect = (reason: string, error?: unknown): void => {
    if (reconnectTimer) return; // Already scheduled

    const delay = Math.min(BASE_RETRY_MS * Math.pow(2, reconnectAttempts), MAX_RETRY_MS);
    reconnectAttempts++;

    logger.warn(`${reason}. Reconnecting in ${Math.round(delay / 1000)}s...`, error ?? '');

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      loginAndListen();
    }, delay);
  };

  const loginAndListen = (): void => {
    const credentials = LOGIN_CREDENTIALS?.email && LOGIN_CREDENTIALS?.password
      ? { email: LOGIN_CREDENTIALS.email, password: LOGIN_CREDENTIALS.password }
      : null;

    const loginWithOptions = (options: Record<string, unknown>, label: string): Promise<IFCAU_API> => {
      return new Promise((resolve, reject) => {
        // Type definitions expect AppstateData, but runtime accepts raw cookie array; cast to satisfy TS.
        login(options as any, (err: Error | null, api: IFCAU_API | null) => {
          if (err || !api) {
            logger.warn(`${label} login failed`, err ?? 'No API instance returned');
            reject(err ?? new Error('Login returned no API instance'));
            return;
          }
          resolve(api);
        });
      });
    };

    const attemptLogin = async (): Promise<IFCAU_API> => {
      const appState = readAppState();

      if (appState) {
        try {
          return await loginWithOptions({ appState: appState as any }, 'Appstate');
        } catch (error) {
          if (credentials) {
            logger.warn('Appstate login failed; attempting email/password login instead.');
            fs.writeFileSync(APPSTATE_PATH, '[]');
          } else {
            throw error;
          }
        }
      }

      if (credentials) {
        logger.warn('Using email/password login because appstate login failed or is missing. A fresh appstate will be saved after login.');
        return loginWithOptions(credentials, 'Credential');
      }

      throw new Error('No appstate.json or login credentials available. Add cookies or set login credentials in config.json.');
    };

    attemptLogin()
      .then(api => {
        reconnectAttempts = 0;
        clearExistingListener();

        fs.writeFileSync(APPSTATE_PATH, JSON.stringify(api.getAppState(), null, 2));
        api.setOptions(config);

        // Run in background so we don't block event listening
        startupBanScan(api).catch(err => logger.warn('Startup ban scan error:', err));

        const stop = api.listenMqtt(async (listenErr, event) => {
          if (listenErr) {
            clearExistingListener();
            scheduleReconnect('listenMqtt error', listenErr);
            return;
          }

          try {
            await handleEvent(api, event);
          } catch (error) {
            logger.error('Error handling event:', error);
          }
        });

        stopListening = typeof stop === 'function' ? stop : undefined;
      })
      .catch(error => {
        console.error('❌ Login error:', error);
        logger.error('Login error:', error);
        scheduleReconnect('Login failed', error ?? undefined);
      });
  };

  loginAndListen();
};
