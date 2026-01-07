import { ICommand, IRunParams } from '../../types';
import { Users } from '../../database/controllers/userController';

const lastDaily = new Map<string, number>();
const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;

const command: ICommand = {
  config: {
    name: "daily",
    version: "2.0.0",
    author: "Donix",
    description: "Claim your daily rewards (money & EXP)",
    category: "Fun",
    usages: ".daily"
  },

  run: async ({ api, event }: IRunParams) => {
    const { senderID, threadID } = event;

    const lastTime = lastDaily.get(senderID) || 0;
    const now = Date.now();
    const timeLeft = DAILY_COOLDOWN - (now - lastTime);

    if (timeLeft > 0) {
      const hours = Math.floor(timeLeft / (60 * 60 * 1000));
      const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
      const msg = `╔═══════════════════════════╗
║     ⏰ DAILY COOLDOWN      ║
╚═══════════════════════════╝

❌ You've already claimed your daily reward!

⏳ Time remaining:
${hours} hours ${minutes} minutes

━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Come back later to claim again!`;
      api.sendMessage(msg, threadID);
      return;
    }

    const reward = Math.floor(Math.random() * 401) + 100;
    const expReward = Math.floor(Math.random() * 41) + 10;

    try {
      const newBalance = await Users.addMoney(senderID, reward);
      const newExp = await Users.addExp(senderID, expReward);

      lastDaily.set(senderID, now);

      const msg = `╔═══════════════════════════╗
║    ✅ DAILY CLAIMED!       ║
╚═══════════════════════════╝

🎁 Rewards Received:

💰 Money: +$${reward.toLocaleString()}
⭐ EXP: +${expReward} XP

━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Current Balance:

💵 Total Money: $${newBalance.toLocaleString()}
📈 Total EXP: ${newExp.toLocaleString()} XP

⏰ Next claim: 24 hours`;

      api.sendMessage(msg, threadID);
    } catch (error) {
      api.sendMessage("❌ An error occurred while claiming daily rewards!", threadID);
    }
  }
};

export = command;
