import { ICommand, IRunParams } from '../../types';
import User from '../../database/models/User';
import Thread from '../../database/models/Thread';

const command: ICommand = {
  config: {
    name: "info",
    version: "1.0.0",
    author: "Donix",
    description: "View info saved in DB",
    category: "System"
  },

  run: async ({ api, event }: IRunParams) => {
    const { senderID, threadID, isGroup } = event;

    try {
      const user = await User.findByPk(senderID);

      let msg = `╔═══════════════════════════╗\n║       👤 USER INFO        ║\n╚═══════════════════════════╝\n\n`;
      if (user) {
        msg += `👤 Name: ${user.name}\n`;
        msg += `⚧️ Gender: ${user.gender}\n`;
        msg += `💰 Money: ${user.money}$\n`;
        msg += `⭐ EXP: ${user.exp}\n`;
      } else {
        msg += `❌ User info not found\n`;
      }

      if (isGroup) {
        const thread = await Thread.findByPk(threadID);
        msg += `\n╔═══════════════════════════╗\n║      🏠 GROUP INFO        ║\n╚═══════════════════════════╝\n\n`;
        if (thread) {
          msg += `🏠 Group Name: ${thread.name}\n`;
          msg += `⚡ Prefix: ${thread.prefix}\n`;
          msg += `📈 Rankup: ${thread.rankup ? '✅ Enabled' : '❌ Disabled'}\n`;
        } else {
          msg += `❌ Group info not found\n`;
        }
      }

      api.sendMessage(msg, threadID);
    } catch (error) {
      api.sendMessage("❌ An error occurred while fetching info!", threadID);
    }
  }
};

export = command;
