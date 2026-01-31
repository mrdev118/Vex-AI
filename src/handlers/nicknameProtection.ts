import type { IFCAU_API } from '@dongdev/fca-unofficial';
import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ThreadEventType } from '../../types';
import { logger } from '../utils/logger';
import { isGroupAdmin } from '../utils/permissions';
import { isOwner } from '../config';
import { Threads } from '../../database/controllers/threadController';

export const PROTECTED_GROUP_NAME = '𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 | Season 1 | Bedrock Only';
const STAFF_NAME_KEYWORDS = ['staff', "staff's", 'staffs', 'staff gc', 'staffs gc'];
const PROTECTED_THREAD_THEME = '#0084ff';

type ProtectionTargets = {
  name: string;
  theme?: string;
};

// Cache protected targets per thread to avoid repeated DB hits
const protectionCache = new Map<string, ProtectionTargets>();

// Tracks the last known nickname per thread/user so we can restore it after blocked changes
const nicknameCache = new Map<string, Map<string, string>>();

// Persisted nickname baselines per thread
const protectedNicknamesCache = new Map<string, Map<string, string>>();

// Tracks reverts initiated by the bot to avoid re-triggering on the bot's own nickname changes
const botRevertInProgress = new Set<string>();

// Cache to track recent nickname changes to prevent loops
const recentChanges = new Map<string, number>();
const CHANGE_COOLDOWN = 3000; // 3 seconds cooldown

export const clearProtectionCache = (threadID: string): void => {
  protectionCache.delete(threadID);
  protectedNicknamesCache.delete(threadID);
};

const normalizeNickname = (value?: string): string => (value || '').trim();
const normalizeTheme = (value?: string): string => (value || '').trim().toLowerCase();

const serializeProtectedNicknames = (map: Map<string, string>): Record<string, string> => {
  const serialized: Record<string, string> = {};
  map.forEach((nickname, userID) => {
    serialized[userID] = normalizeNickname(nickname);
  });
  return serialized;
};

const persistProtectedNicknames = async (threadID: string, map: Map<string, string>): Promise<void> => {
  const settings = await Threads.getSettings(threadID);
  (settings as any).protectedNicknames = serializeProtectedNicknames(map);
  await Threads.setSettings(threadID, settings);
  protectedNicknamesCache.set(threadID, map);
};

const extractNicknamesFromInfo = (info: any): Record<string, string> => {
  if (!info?.nicknames || typeof info.nicknames !== 'object') return {};

  return Object.entries(info.nicknames).reduce<Record<string, string>>((acc, [id, nickname]) => {
    const userID = String(id || '').trim();
    if (userID) acc[userID] = normalizeNickname(typeof nickname === 'string' ? nickname : '');
    return acc;
  }, {});
};

const extractThemeFromInfo = (info: any): string | undefined => {
  const themeCandidate =
    info?.themeID ||
    info?.theme_id ||
    info?.theme_color ||
    info?.threadTheme ||
    info?.threadColor ||
    info?.color;

  const theme = typeof themeCandidate === 'string' ? themeCandidate : undefined;
  return theme ? theme.trim() : undefined;
};

const getThreadImageUrlFromInfo = (info: any): string => {
  const candidate = info?.imageSrc || info?.thumbSrc || info?.thumbnailUrl || info?.threadImage || info?.picture;
  return typeof candidate === 'string' ? candidate : '';
};

const isStaffThread = (threadID: string, threadInfo?: any): boolean => {
  const name = String(threadInfo?.threadName || threadInfo?.name || '').toLowerCase();
  return STAFF_NAME_KEYWORDS.some(keyword => name.includes(keyword.toLowerCase()));
};

const getProtectedNicknames = async (
  threadID: string,
  seed?: Record<string, string>
): Promise<Map<string, string>> => {
  const cached = protectedNicknamesCache.get(threadID);
  if (cached) return cached;

  const settings = await Threads.getSettings(threadID);
  const raw = (settings as any).protectedNicknames;
  const map = new Map<string, string>();

  if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([id, nickname]) => {
      const userID = String(id || '').trim();
      if (userID) map.set(userID, normalizeNickname(typeof nickname === 'string' ? nickname : ''));
    });
  }

  if (!map.size && seed && typeof seed === 'object') {
    Object.entries(seed).forEach(([id, nickname]) => {
      const userID = String(id || '').trim();
      if (userID) map.set(userID, normalizeNickname(nickname));
    });
    await persistProtectedNicknames(threadID, map);
  } else {
    protectedNicknamesCache.set(threadID, map);
  }

  return map;
};

const mapFromRecord = (record: Record<string, string>): Map<string, string> => {
  const map = new Map<string, string>();
  Object.entries(record).forEach(([id, nickname]) => {
    const userID = String(id || '').trim();
    if (userID) map.set(userID, normalizeNickname(nickname));
  });
  return map;
};

const getProtectedPhoto = async (
  threadID: string,
  threadInfo?: any
): Promise<string> => {
  const settings = await Threads.getSettings(threadID);
  let url = '';

  if (typeof (settings as any).protectedPhoto === 'string') {
    url = (settings as any).protectedPhoto.trim();
  }

  if (!url) {
    url = getThreadImageUrlFromInfo(threadInfo);
    if (url) {
      (settings as any).protectedPhoto = url;
      await Threads.setSettings(threadID, settings);
    }
  }

  return url;
};

const setProtectedPhoto = async (threadID: string, url: string): Promise<void> => {
  const normalized = url.trim();
  if (!normalized) return;
  const settings = await Threads.getSettings(threadID);
  (settings as any).protectedPhoto = normalized;
  await Threads.setSettings(threadID, settings);
};

const setProtectedNickname = async (threadID: string, userID: string, nickname: string): Promise<void> => {
  const normalized = normalizeNickname(nickname);
  const map = await getProtectedNicknames(threadID);
  const current = map.get(userID) ?? '';
  if (current === normalized) return;

  map.set(userID, normalized);
  await persistProtectedNicknames(threadID, map);
};

const getProtectedNicknameValue = async (threadID: string, userID: string): Promise<string> => {
  const map = await getProtectedNicknames(threadID);
  return map.get(userID) ?? '';
};

const getProtectionTargets = async (threadID: string, threadInfo?: any): Promise<ProtectionTargets> => {
  const cached = protectionCache.get(threadID);
  if (cached) return cached;

  const settings = await Threads.getSettings(threadID);

  let protectedName = typeof (settings as any).protectedName === 'string'
    ? (settings as any).protectedName.trim()
    : (threadInfo?.threadName || threadInfo?.name || '').trim();

  let protectedTheme = typeof (settings as any).protectedTheme === 'string'
    ? (settings as any).protectedTheme.trim()
    : '';

  let shouldPersist = false;

  if (!protectedName) {
    protectedName = PROTECTED_GROUP_NAME;
    (settings as any).protectedName = protectedName;
    shouldPersist = true;
  }

  if (!protectedTheme) {
    const themeFromInfo = extractThemeFromInfo(threadInfo);
    if (themeFromInfo) {
      protectedTheme = themeFromInfo;
      (settings as any).protectedTheme = protectedTheme;
      shouldPersist = true;
    } else {
      // Fall back to default Messenger blue if nothing else is known
      protectedTheme = PROTECTED_THREAD_THEME;
    }
  }

  if (shouldPersist) {
    await Threads.setSettings(threadID, settings);
  }

  const targets: ProtectionTargets = { name: protectedName, theme: protectedTheme };
  protectionCache.set(threadID, targets);
  return targets;
};

const updateProtectionTargets = async (
  threadID: string,
  updates: Partial<ProtectionTargets>
): Promise<void> => {
  const settings = await Threads.getSettings(threadID);
  const current = await getProtectionTargets(threadID);

  let changed = false;

  if (updates.name && updates.name !== (settings as any).protectedName) {
    (settings as any).protectedName = updates.name;
    changed = true;
  }

  if (updates.theme && updates.theme !== (settings as any).protectedTheme) {
    (settings as any).protectedTheme = updates.theme;
    changed = true;
  }

  if (changed) {
    await Threads.setSettings(threadID, settings);
  }

  protectionCache.set(threadID, {
    name: updates.name || current.name,
    theme: updates.theme || current.theme,
  });
};

// Fetch thread nicknames once per thread so we have a baseline to restore
const ensureThreadNicknamesCached = async (
  api: IFCAU_API,
  threadID: string,
  forceRefresh = false
): Promise<void> => {
  if (!forceRefresh && nicknameCache.has(threadID)) return;

  await new Promise<void>((resolve) => {
    api.getThreadInfo(threadID, (err, threadInfo) => {
      if (!err && threadInfo?.nicknames) {
        const map = new Map<string, string>();
        const seed: Record<string, string> = {};

        Object.entries(threadInfo.nicknames).forEach(([id, nickname]) => {
          const normalizedID = String(id || '').trim();
          const normalizedNickname = normalizeNickname(typeof nickname === 'string' ? nickname : '');

          if (normalizedID) {
            map.set(normalizedID, normalizedNickname);
            seed[normalizedID] = normalizedNickname;
          }
        });

        nicknameCache.set(threadID, map);

        getProtectedNicknames(threadID, seed).catch(() => {
          /* best effort to seed protected nicknames */
        });
      } else {
        // Keep an empty cache entry so we do not refetch on every call
        nicknameCache.set(threadID, new Map());
        if (err) {
          logger.debug(`Failed to warm nickname cache for ${threadID}:`, err);
        }
      }
      resolve();
    });
  });
};

export const warmNicknameCache = async (
  api: IFCAU_API,
  threadID: string,
  forceRefresh = false
): Promise<void> => {
  await ensureThreadNicknamesCached(api, threadID, forceRefresh);
};

const getCachedNickname = (threadID: string, userID: string): string => {
  return nicknameCache.get(threadID)?.get(userID) ?? '';
};

const setCachedNickname = (threadID: string, userID: string, nickname: string): void => {
  if (!nicknameCache.has(threadID)) {
    nicknameCache.set(threadID, new Map());
  }
  nicknameCache.get(threadID)!.set(userID, normalizeNickname(nickname));
};

const canMakeChange = (key: string): boolean => {
  const lastChange = recentChanges.get(key);
  const now = Date.now();
  
  if (lastChange && now - lastChange < CHANGE_COOLDOWN) {
    return false;
  }
  
  recentChanges.set(key, now);
  
  // Clean up old entries
  setTimeout(() => {
    recentChanges.delete(key);
  }, CHANGE_COOLDOWN + 1000);
  
  return true;
};

export const handleNicknameProtection = async (
  api: IFCAU_API,
  event: ThreadEventType
): Promise<void> => {
  if (event.type !== "event") return;

  const threadID = String(event.threadID);
  const author = String(event.author ?? '');
  const botID = String(api.getCurrentUserID?.() ?? '');
  const botRevertKey = (participantID: string): string => `${threadID}-${participantID}`;

  // Feature 1: Protect group chat name - only admins can change it
  if (event.logMessageType === 'log:thread-name') {
    try {
      const logData = (event as any).logMessageData;
      const newName = logData?.name || '';
      if (isStaffThread(threadID, (event as any).threadInfo)) return;
      const { name: targetName } = await getProtectionTargets(threadID);

      if (!targetName || newName === targetName) {
        return;
      }

      if (author === botID) {
        return;
      }
      
      // Check if the author is a group admin or bot owner
      const isAuthorAdmin = await isGroupAdmin(api, author, threadID);
      const isAuthorOwner = isOwner(author);
      
      if (!isAuthorAdmin && !isAuthorOwner) {
        // Non-admin tried to change the group name
        const changeKey = `thread-name-${threadID}`;
        
        if (canMakeChange(changeKey)) {
          // Revert the name back to protected name
          api.setTitle(targetName, threadID, (err) => {
            if (err) {
              logger.error('Error reverting group name:', err);
            } else {
              logger.info(`Group name restored to protected name in ${threadID}`);
              api.sendMessage(
                `━━━━━━━━━━━━━━━━━━━━\n⚠️ 𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 𝗦𝗲𝗰𝘂𝗿𝗶𝘁𝘆\n━━━━━━━━━━━━━━━━━━━━\n\n🚫 𝗔𝗰𝘁𝗶𝗼𝗻 𝗗𝗲𝗻𝗶𝗲𝗱!\nOnly group admins can change the group name.\n\n✅ Group name has been restored to:\n${targetName}\n\n━━━━━━━━━━━━━━━━━━━━`,
                threadID
              );
            }
          });
        }
      } else if (newName && newName !== targetName) {
        await updateProtectionTargets(threadID, { name: newName });
      }
    } catch (error) {
      logger.error('Error in group name protection:', error);
    }
  }

  // Feature 1b: Protect group chat theme/color - only admins can change it
  if (event.logMessageType === 'log:thread-color') {
    try {
      const logData = (event as any).logMessageData;
      const newTheme = logData?.theme_color || logData?.theme_id || logData?.themeID || '';
      if (isStaffThread(threadID, (event as any).threadInfo)) return;
      const { theme: targetTheme } = await getProtectionTargets(threadID, logData);

      if (!targetTheme) return;

      if (normalizeTheme(newTheme) === normalizeTheme(targetTheme)) {
        return;
      }

      if (author === botID) {
        return;
      }

      const isAuthorAdmin = await isGroupAdmin(api, author, threadID);
      const isAuthorOwner = isOwner(author);

      if (!isAuthorAdmin && !isAuthorOwner) {
        const changeKey = `thread-theme-${threadID}`;

        if (canMakeChange(changeKey) && normalizeTheme(newTheme) !== normalizeTheme(targetTheme)) {
          const changeThreadColor = (api as any).changeThreadColor as
            | ((color: string, id: string, cb: (err: any) => void) => void)
            | undefined;

          if (!changeThreadColor) {
            logger.warn('API does not support changeThreadColor; cannot restore theme');
            return;
          }

          changeThreadColor(targetTheme, threadID, (err: any) => {
            if (err) {
              logger.error('Error reverting group theme:', err);
              return;
            }

            logger.info(`Group theme restored for ${threadID}`);
            api.sendMessage(
              `━━━━━━━━━━━━━━━━━━━━\n⚠️ 𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 𝗦𝗲𝗰𝘂𝗿𝗶𝘁𝘆\n━━━━━━━━━━━━━━━━━━━━\n\n🚫 𝗔𝗰𝘁𝗶𝗼𝗻 𝗗𝗲𝗻𝗶𝗲𝗱!\nOnly group admins can change the group theme.\n\n✅ Theme has been restored.\n\n━━━━━━━━━━━━━━━━━━━━`,
              threadID
            );
          });
        }
      } else if (newTheme && normalizeTheme(newTheme) !== normalizeTheme(targetTheme)) {
        await updateProtectionTargets(threadID, { theme: newTheme });
      }
    } catch (error) {
      logger.error('Error in group theme protection:', error);
    }
  }

  // Feature 2: Protect group chat photo - only admins can change it
  if (event.logMessageType === 'log:thread-icon') {
    try {
      if (isStaffThread(threadID, (event as any).threadInfo)) return;

      // Check if the author is a group admin
      const isAuthorAdmin = await isGroupAdmin(api, author, threadID);
      
      const newPhotoUrl = (event as any).logMessageData?.profile_picture || '';
      const targetPhotoUrl = await getProtectedPhoto(threadID);

      if (!isAuthorAdmin && !isOwner(author)) {
        // Non-admin tried to change the group photo
        const changeKey = `thread-icon-${threadID}`;
        
        if (canMakeChange(changeKey) && targetPhotoUrl) {
          logger.info(`Group photo change detected by non-admin in ${threadID}; restoring.`);
          const restored = await restorePhotoToTarget(api, threadID, targetPhotoUrl, true);
          if (!restored) {
            api.sendMessage(
              `━━━━━━━━━━━━━━━━━━━━\n⚠️ 𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 𝗦𝗲𝗰𝘂𝗿𝗶𝘁𝘆\n━━━━━━━━━━━━━━━━━━━━\n\n🚫 𝗔𝗰𝘁𝗶𝗼𝗻 𝗗𝗲𝗻𝗶𝗲𝗱!\nOnly group admins can change the group photo.\n\n━━━━━━━━━━━━━━━━━━━━`,
              threadID
            );
          }
        }
      } else {
        // Admin/owner changed photo: update baseline if provided or fetch from thread info
        const photoToPersist = newPhotoUrl || targetPhotoUrl || getThreadImageUrlFromInfo((event as any).threadInfo);
        if (photoToPersist) {
          await setProtectedPhoto(threadID, photoToPersist);
        }
      }
    } catch (error) {
      logger.error('Error in group photo protection:', error);
    }
  }

  // Feature 3: Prevent members from changing other people's nicknames
  if (event.logMessageType === 'log:user-nickname') {
    try {
      await ensureThreadNicknamesCached(api, threadID);

      const logData = (event as any).logMessageData;
      const targetUserID = String(logData?.participant_id ?? '');
      const nickname = normalizeNickname(logData?.nickname || '');

      if (!targetUserID) return;

      // If the user is changing their own nickname, accept and update cache
      if (author === targetUserID) {
        setCachedNickname(threadID, targetUserID, nickname || '');
        await setProtectedNickname(threadID, targetUserID, nickname || '');
        return;
      }

      // Ignore changes performed by the bot itself (e.g., when reverting nicknames)
      if (author && botID && author === botID) {
        setCachedNickname(threadID, targetUserID, nickname || '');
        botRevertInProgress.delete(botRevertKey(targetUserID));
        await setProtectedNickname(threadID, targetUserID, nickname || '');
        return;
      }

      // If this event is part of a bot-initiated revert, skip handling
      if (botRevertInProgress.has(botRevertKey(targetUserID))) {
        setCachedNickname(threadID, targetUserID, nickname || '');
        botRevertInProgress.delete(botRevertKey(targetUserID));
        await setProtectedNickname(threadID, targetUserID, nickname || '');
        return;
      }

      const isAuthorAdmin = await isGroupAdmin(api, author, threadID);
      const isAuthorOwner = isOwner(author);

      if (!isAuthorAdmin && !isAuthorOwner) {
        const changeKey = `nickname-${threadID}-${targetUserID}-${author}`;

        if (canMakeChange(changeKey)) {
          const storedNickname = await getProtectedNicknameValue(threadID, targetUserID);
          const previousNickname = storedNickname || getCachedNickname(threadID, targetUserID);
          const revertNickname = normalizeNickname(previousNickname);

          botRevertInProgress.add(botRevertKey(targetUserID));

          api.changeNickname(revertNickname, threadID, targetUserID, (err) => {
            if (err) {
              logger.error('Error reverting nickname:', err);
              botRevertInProgress.delete(botRevertKey(targetUserID));
              return;
            }

            // Keep cache aligned with the reverted nickname
            setCachedNickname(threadID, targetUserID, revertNickname);

            setProtectedNickname(threadID, targetUserID, revertNickname).catch(() => {
              /* best effort persistence */
            });

            // Refresh cache in the background to pick up any other changes in the thread
            ensureThreadNicknamesCached(api, threadID, true).catch(() => {
              /* best effort */
            });

            logger.info(`Reverted nickname change for user ${targetUserID} in ${threadID}`);

            api.getUserInfo([author, targetUserID], (infoErr, userInfo) => {
              if (infoErr || !userInfo) return;

              const authorName = userInfo[author]?.name || 'Someone';
              const targetName = userInfo[targetUserID]?.name || 'another user';

              api.sendMessage(
                `━━━━━━━━━━━━━━━━━━━━\n⚠️ 𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 𝗦𝗲𝗰𝘂𝗿𝗶𝘁𝘆\n━━━━━━━━━━━━━━━━━━━━\n\n🚫 𝗔𝗰𝘁𝗶𝗼𝗻 𝗗𝗲𝗻𝗶𝗲𝗱!\n@${authorName}, you can only change your own nickname, not ${targetName}'s!\n\n✅ Nickname has been restored.\n\n━━━━━━━━━━━━━━━━━━━━`,
                threadID
              );
            });
          });
        }
      } else {
        // Admins/owners are allowed; update cache so we remember the new nickname
        setCachedNickname(threadID, targetUserID, nickname || '');
        await setProtectedNickname(threadID, targetUserID, nickname || '');
      }
    } catch (error) {
      logger.error('Error in nickname protection:', error);
    }
  }
};

const restoreNameToTarget = async (
  api: IFCAU_API,
  threadID: string,
  targetName: string,
  notify: boolean
): Promise<boolean> => {
  if (!targetName) return false;

  return await new Promise<boolean>((resolve) => {
    api.setTitle(targetName, threadID, (err) => {
      if (err) {
        const message = String((err as any)?.error || (err as any)?.message || err);

        if (message.toLowerCase().includes('single-user chat')) {
          logger.warn(`Skipping title restore for single-user thread ${threadID}`);
        } else {
          logger.error('Error restoring group name on startup scan:', err);
        }
        return resolve(false);
      }

      logger.info(`Group name enforced for ${threadID}`);

      if (notify) {
        api.sendMessage(
          `━━━━━━━━━━━━━━━━━━━━\n⚠️ 𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 𝗦𝗲𝗰𝘂𝗿𝗶𝘁𝘆\n━━━━━━━━━━━━━━━━━━━━\n\n✅ Group name has been restored to:\n${targetName}\n\n━━━━━━━━━━━━━━━━━━━━`,
          threadID
        );
      }

      resolve(true);
    });
  });
};

const restoreThemeToTarget = async (
  api: IFCAU_API,
  threadID: string,
  targetTheme: string,
  notify: boolean
): Promise<boolean> => {
  if (!targetTheme) return false;

  const changeThreadColor = (api as any).changeThreadColor as
    | ((color: string, id: string, cb: (err: any) => void) => void)
    | undefined;

  if (!changeThreadColor) {
    logger.warn('API does not support changeThreadColor; skipping theme restore');
    return false;
  }

  return await new Promise<boolean>((resolve) => {
    changeThreadColor(targetTheme, threadID, (err: any) => {
      if (err) {
        logger.error('Error restoring group theme on startup scan:', err);
        return resolve(false);
      }

      logger.info(`Group theme enforced for ${threadID}`);

      if (notify) {
        api.sendMessage(
          `━━━━━━━━━━━━━━━━━━━━\n⚠️ 𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 𝗦𝗲𝗰𝘂𝗿𝗶𝘁𝘆\n━━━━━━━━━━━━━━━━━━━━\n\n✅ Group theme has been restored.\n\n━━━━━━━━━━━━━━━━━━━━`,
          threadID
        );
      }

      resolve(true);
    });
  });
};

const restorePhotoToTarget = async (
  api: IFCAU_API,
  threadID: string,
  photoUrl: string,
  notify: boolean
): Promise<boolean> => {
  if (!photoUrl) return false;

  const changeGroupImage = (api as any).changeGroupImage as
    | ((stream: fs.ReadStream, id: string, cb: (err: any) => void) => void)
    | undefined;

  if (!changeGroupImage) {
    logger.warn('API does not support changeGroupImage; cannot restore group photo');
    return false;
  }

  const tmpPath = path.join(os.tmpdir(), `vex-photo-${threadID}-${Date.now()}.jpg`);

  try {
    const response = await axios.get(photoUrl, { responseType: 'arraybuffer' });
    await fs.promises.writeFile(tmpPath, Buffer.from(response.data));

    await new Promise<void>((resolve, reject) => {
      changeGroupImage(fs.createReadStream(tmpPath), threadID, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    if (notify) {
      api.sendMessage(
        `━━━━━━━━━━━━━━━━━━━━\n⚠️ 𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 𝗦𝗲𝗰𝘂𝗿𝗶𝘁𝘆\n━━━━━━━━━━━━━━━━━━━━\n\n✅ Group photo has been restored.\n\n━━━━━━━━━━━━━━━━━━━━`,
        threadID
      );
    }

    return true;
  } catch (error) {
    logger.error('Error restoring group photo:', error);
    return false;
  } finally {
    fs.promises.unlink(tmpPath).catch(() => {/* ignore */});
  }
};

const restoreNicknameToTarget = async (
  api: IFCAU_API,
  threadID: string,
  participantID: string,
  targetNickname: string,
  notify: boolean
): Promise<boolean> => {
  const revertNickname = normalizeNickname(targetNickname);
  const revertKey = `${threadID}-${participantID}`;

  return await new Promise<boolean>((resolve) => {
    botRevertInProgress.add(revertKey);

    api.changeNickname(revertNickname, threadID, participantID, (err) => {
      if (err) {
        logger.error('Error restoring nickname on startup scan:', err);
        botRevertInProgress.delete(revertKey);
        return resolve(false);
      }

      setCachedNickname(threadID, participantID, revertNickname);

      setProtectedNickname(threadID, participantID, revertNickname).catch(() => {
        /* best effort persistence */
      });

      botRevertInProgress.delete(revertKey);

      if (notify) {
        api.sendMessage(
          `━━━━━━━━━━━━━━━━━━━━\n⚠️ 𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 𝗦𝗲𝗰𝘂𝗿𝗶𝘁𝘆\n━━━━━━━━━━━━━━━━━━━━\n\n✅ Nickname has been restored.\n\n━━━━━━━━━━━━━━━━━━━━`,
          threadID,
          () => resolve(true)
        );
        return;
      }

      resolve(true);
    });
  });
};

export const enforceNicknameSnapshot = async (
  api: IFCAU_API,
  threadID: string,
  threadInfo?: any,
  notify = false
): Promise<{ restored: number }> => {
  const nicknamesFromInfo = extractNicknamesFromInfo(threadInfo);
  const protectedNicknames = await getProtectedNicknames(threadID, nicknamesFromInfo);

  let restored = 0;
  let changed = false;

  Object.entries(nicknamesFromInfo).forEach(([userID, nickname]) => {
    setCachedNickname(threadID, userID, nickname);

    if (!protectedNicknames.has(userID)) {
      protectedNicknames.set(userID, nickname);
      changed = true;
    }
  });

  for (const [participantID, targetNickname] of protectedNicknames.entries()) {
    const currentNickname = nicknamesFromInfo[participantID] ?? getCachedNickname(threadID, participantID);

    if (normalizeNickname(currentNickname) !== normalizeNickname(targetNickname)) {
      const success = await restoreNicknameToTarget(api, threadID, participantID, targetNickname, notify);
      if (success) {
        restored += 1;
        changed = true;
      }
    }
  }

  if (changed) {
    await persistProtectedNicknames(threadID, protectedNicknames);
  }

  return { restored };
};

export const enforcePhotoSnapshot = async (
  api: IFCAU_API,
  threadID: string,
  threadInfo?: any,
  notify = false
): Promise<{ restored: boolean }> => {
  const participantIDs = Array.isArray(threadInfo?.participantIDs) ? threadInfo.participantIDs : [];
  const participantsCount = participantIDs.length;
  const isUserThread = threadInfo?.isCanonicalUser === true || participantsCount <= 2;
  const isGroupThread = threadInfo?.isGroup === true || participantsCount > 2;

  if (!isGroupThread || isUserThread || isStaffThread(threadID, threadInfo)) {
    return { restored: false };
  }

  const protectedPhoto = await getProtectedPhoto(threadID, threadInfo);
  const currentPhoto = getThreadImageUrlFromInfo(threadInfo);

  if (!protectedPhoto) {
    if (currentPhoto) await setProtectedPhoto(threadID, currentPhoto);
    return { restored: false };
  }

  if (currentPhoto && currentPhoto.trim() === protectedPhoto.trim()) {
    return { restored: false };
  }

  const restored = await restorePhotoToTarget(api, threadID, protectedPhoto, notify);
  return { restored };
};

export const enforceProtectionSnapshot = async (
  api: IFCAU_API,
  threadID: string,
  threadInfo?: any,
  notify = false
): Promise<{ nameRestored: boolean; themeRestored: boolean }> => {
  const { name: targetName, theme: targetTheme } = await getProtectionTargets(threadID, threadInfo);

  const participantIDs = Array.isArray(threadInfo?.participantIDs) ? threadInfo.participantIDs : [];
  const participantsCount = participantIDs.length;
  const isUserThread = threadInfo?.isCanonicalUser === true || participantsCount <= 2;
  const isGroupThread = threadInfo?.isGroup === true || participantsCount > 2;

  if (!isGroupThread || isUserThread) {
    return { nameRestored: false, themeRestored: false };
  }
  
  if (isStaffThread(threadID, threadInfo)) {
    return { nameRestored: false, themeRestored: false };
  }

  const currentName = threadInfo?.threadName || threadInfo?.name || '';
  const currentTheme = extractThemeFromInfo(threadInfo);

  let nameRestored = false;
  let themeRestored = false;

  if (targetName && currentName && currentName !== targetName) {
    nameRestored = await restoreNameToTarget(api, threadID, targetName, notify);
  }

  if (targetTheme && currentTheme && normalizeTheme(currentTheme) !== normalizeTheme(targetTheme)) {
    themeRestored = await restoreThemeToTarget(api, threadID, targetTheme, notify);
  }

  return { nameRestored, themeRestored };
};
