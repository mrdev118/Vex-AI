import { ICommand, IRunParams } from '../../types';
import User from '../../database/models/User';
import Thread from '../../database/models/Thread';

const command: ICommand = {
  config: {
    name: "info",
    version: "1.0.0",
    author: "Donix",
    description: "View saved user and group info",
    category: "System"
  },

  run: async ({ api, event }: IRunParams) => {
    const { senderID, threadID, isGroup } = event;

    const formatNumber = (value?: number) =>
      typeof value === 'number' ? value.toLocaleString() : '0';

    const safeParseArray = (value?: string) => {
      try {
        if (!value) return [] as string[];
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [] as string[];
      }
    };

    const safeParseObjectKeys = (value?: string) => {
      try {
        if (!value) return [] as string[];
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? Object.keys(parsed) : [];
      } catch (error) {
        return [] as string[];
      }
    };

    try {
      const user = await User.findByPk(senderID);

      let msg = `╔═══════════════════════════╗\n║       👤 USER INFO        ║\n╚═══════════════════════════╝\n\n`;
      if (user) {
        msg += `👤 Name: ${user.name || 'Unknown'}\n`;
        msg += `⚧️ Gender: ${user.gender || 'Unknown'}\n`;
        msg += `💰 Money: $${formatNumber(user.money)}\n`;
        msg += `⭐ EXP: ${formatNumber(user.exp)} XP\n`;
      } else {
        msg += `❌ User info not found in database\n`;
      }

      if (isGroup) {
        const thread = await Thread.findByPk(threadID);
        msg += `\n╔═══════════════════════════╗\n║      🏠 GROUP INFO        ║\n╚═══════════════════════════╝\n\n`;
        if (thread) {
          const bannedUsers = safeParseArray(thread.bannedUsers);
          const settingsKeys = safeParseObjectKeys(thread.settings);

          msg += `🏠 Group Name: ${thread.name || 'Unknown group'}\n`;
          msg += `⚡ Prefix: ${thread.prefix || '!'}\n`;
          msg += `📈 Rankup: ${thread.rankup ? '✅ Enabled' : '❌ Disabled'}\n`;
          msg += `🚫 Banned Users: ${bannedUsers.length}\n`;
          msg += `🛠️ Settings Keys: ${settingsKeys.length > 0 ? settingsKeys.join(', ') : 'None'}\n`;
        } else {
          msg += `❌ Group info not found in database\n`;
        }
      }

      api.sendMessage(msg, threadID);
    } catch (error) {
      api.sendMessage("❌ An error occurred while fetching info!", threadID);
    }
  }
};

export = command;
