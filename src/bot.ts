import type { IFCAU_API } from '@dongdev/fca-unofficial';
import login from '@dongdev/fca-unofficial';
import * as fs from 'fs';
import { APPSTATE_PATH, LOGIN_CREDENTIALS, config } from './config';
import { handleEvent } from './handlers';
import { loadCommands } from './loader';
import { logger } from './utils/logger';

const BASE_RETRY_MS = 5_000;
const MAX_RETRY_MS = 5 * 60_000;

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
      logger.warn('appstate.json does not look like valid appstate cookies. Ignoring the file.');
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
