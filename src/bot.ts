import type { IFCAU_API } from '@dongdev/fca-unofficial';
import login from '@dongdev/fca-unofficial';
import * as fs from 'fs';
import { APPSTATE_PATH, config } from './config';
import { handleEvent } from './handlers';
import { loadCommands } from './loader';
import { logger } from './utils/logger';

const BASE_RETRY_MS = 5_000;
const MAX_RETRY_MS = 5 * 60_000;

const readAppState = (): unknown[] | null => {
  if (!fs.existsSync(APPSTATE_PATH)) {
    logger.error('Missing appstate.json file');
    return null;
  }

  try {
    const raw = fs.readFileSync(APPSTATE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || (Array.isArray(parsed) && parsed.length === 0)) {
      logger.warn('appstate.json is empty. Please add cookies for the bot to work.');
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
    const appState = readAppState();
    if (!appState) return;

    // Type definitions expect AppstateData, but runtime accepts raw cookie array; cast to satisfy TS.
    login({ appState: appState as any }, (err: Error | null, api: IFCAU_API | null) => {
      if (err || !api) {
        console.error('❌ Login error:', err);
        logger.error('Login error:', err);
        scheduleReconnect('Login failed', err ?? undefined);
        return;
      }

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
    });
  };

  loginAndListen();
};
