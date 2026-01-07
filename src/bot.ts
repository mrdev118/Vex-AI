import type { IFCAU_API } from '@dongdev/fca-unofficial';
import login from '@dongdev/fca-unofficial';
import * as fs from 'fs';
import { APPSTATE_PATH, config } from './config';
import { handleEvent } from './handlers';
import { loadCommands } from './loader';
import { logger } from './utils/logger';

export const startBot = (): void => {
  loadCommands();

  if (!fs.existsSync(APPSTATE_PATH)) {
    logger.error("Missing appstate.json file");
    return;
  }

  let appState;
  try {
    appState = JSON.parse(fs.readFileSync(APPSTATE_PATH, 'utf8'));
  } catch (error) {
    logger.error("appstate.json file has invalid JSON format. Resetting to empty.", error);
    appState = [];
    fs.writeFileSync(APPSTATE_PATH, '[]');
  }

  if (!appState || (Array.isArray(appState) && appState.length === 0)) {
    logger.warn("appstate.json file is empty. Please add cookies to appstate.json for the bot to work.");
    return;
  }

  login({ appState }, (err: Error | null, api: IFCAU_API | null) => {
    if (err) {
      console.error("❌ Login error:", err);
      logger.error("Login error:", err);
      return;
    }
    if (!api) return;

    fs.writeFileSync(APPSTATE_PATH, JSON.stringify(api.getAppState(), null, 2));

    api.setOptions(config);

    api.listenMqtt(async (err, event) => {
      if (err) {
        logger.error("listenMqtt error:", err);
        return;
      }
      await handleEvent(api, event);
    });
  });
};
