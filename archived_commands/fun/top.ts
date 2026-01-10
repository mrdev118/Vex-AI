import { ICommand, IRunParams } from '../../types';
import { Users } from '../../database/controllers/userController';

const command: ICommand = {
  config: {
    name: "top",
    version: "1.0.0",
    author: "Donix",
    description: "View top players by money or EXP",
    category: "Fun"
  },

  run: async ({ api, event, args }: IRunParams) => {
    const { threadID } = event;

    const type = args[0]?.toLowerCase() || "money";
    const limit = 10;

    try {
      let topUsers;
      let title;

      if (type === "exp" || type === "experience") {
        topUsers = await Users.getTopExp(limit);
        title = "🏆 TOP EXP";
      } else {
        topUsers = await Users.getTopMoney(limit);
        title = "🏆 TOP MONEY";
      }

      if (topUsers.length === 0) {
        api.sendMessage("📭 No data available yet!", threadID);
        return;
      }

      let message = `${title}\n\n`;

      topUsers.forEach((user, index) => {
        const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
        const value = type === "exp" ? user.exp.toLocaleString() : user.money.toLocaleString();
        const unit = type === "exp" ? " EXP" : " $";

        message += `${medal} ${user.name}: ${value}${unit}\n`;
      });

      api.sendMessage(message.trim(), threadID);
    } catch (error) {
      api.sendMessage("❌ An error occurred while fetching the leaderboard!", threadID);
    }
  }
};

export = command;
