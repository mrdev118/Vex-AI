import { ICommand, IRunParams } from '../../types';

const command: ICommand = {
  config: {
    name: "balance",
    version: "2.0.0",
    author: "Donix",
    description: "Check your money and EXP balance",
    category: "Fun",
    aliases: ["bal", "money", "wallet"],
    usages: ".balance or .balance @user"
  },

  run: async ({ api, event, args, Users, Threads, send, reply, react }: IRunParams) => {
    let targetUID = event.senderID;

    if (args.length > 0 && event.mentions) {
      const mentionedUsers = Object.keys(event.mentions);
      if (mentionedUsers.length > 0) {
        targetUID = mentionedUsers[0];
      }
    }

    try {
      const user = await Users.getData(targetUID);

      const isSelf = targetUID === event.senderID;
      const name = isSelf ? "Your" : `${user.name}'s`;

      const msg = `╔═══════════════════════════╗
║     💰 ACCOUNT INFO       ║
╚═══════════════════════════╝

👤 ${name} Account:

💵 Balance: $${user.money.toLocaleString()}
⭐ Experience: ${user.exp.toLocaleString()} XP

━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Tip: Use .daily to earn money!`;

      await send(msg);
    } catch (error) {
      await send("❌ An error occurred while fetching account info!");
    }
  }
};

export = command;
