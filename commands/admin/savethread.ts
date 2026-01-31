import { ICommand, IRunParams } from '../../types';
import { Threads } from '../../database/controllers/threadController';
import { clearProtectionCache } from '../../src/handlers/nicknameProtection';
import { logger } from '../../src/utils/logger';

const extractThemeFromInfo = (info: any): string => {
  const candidate =
    info?.themeID ||
    info?.theme_id ||
    info?.theme_color ||
    info?.threadTheme ||
    info?.threadColor ||
    info?.color || '';

  return typeof candidate === 'string' ? candidate.trim() : '';
};

const extractPhotoFromInfo = (info: any): string => {
  const candidate =
    info?.imageSrc ||
    info?.thumbSrc ||
    info?.thumbnailUrl ||
    info?.threadImage ||
    info?.picture || '';

  return typeof candidate === 'string' ? candidate.trim() : '';
};

const command: ICommand = {
  config: {
    name: 'savethread',
    version: '1.0.0',
    author: 'GitHub Copilot',
    description: 'Save current group name, photo, and theme as protected values for this thread',
    category: 'Admin',
    usages: 'savethread',
    role: 2 // group admin
  },

  run: async ({ api, event, send }: IRunParams) => {
    const threadID = String(event.threadID);

    const info = await new Promise<any | null>((resolve) => {
      api.getThreadInfo(threadID, (err: Error | null, data: any | null) => {
        if (err) {
          logger.warn('Unable to fetch thread info for savethread:', err);
          return resolve(null);
        }
        resolve(data);
      });
    });

    if (!info) {
      await send('❌ Could not fetch thread info. Try again.');
      return;
    }

    const name = (info.threadName || info.name || '').trim();
    const theme = extractThemeFromInfo(info);
    const photo = extractPhotoFromInfo(info);

    const settings = await Threads.getSettings(threadID);

    if (name) (settings as any).protectedName = name;
    if (theme) (settings as any).protectedTheme = theme;
    if (photo) (settings as any).protectedPhoto = photo;

    await Threads.setSettings(threadID, settings);
    clearProtectionCache(threadID);

    const parts = [
      name ? `📝 Name saved` : '📝 Name missing',
      theme ? `🎨 Theme saved` : '🎨 Theme missing',
      photo ? `🖼️ Photo saved` : '🖼️ Photo missing'
    ];

    await send(`✅ Thread protection updated:\n${parts.join('\n')}`);
  }
};

export = command;
