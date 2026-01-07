import { ICommand, IChatParams, IRunParams } from '../../types';

const discordMessage = `╔═══════════════════════════╗
║   🎮 𝗩𝗘𝗫𝗢𝗡𝗦𝗠𝗣 𝗗𝗜𝗦𝗖𝗢𝗥𝗗   ║
╚═══════════════════════════╝

Join our community server for:
• Latest server updates
• Community events
• Support & help
• Make new friends
• Exclusive perks

🔗 Discord Link:
https://discord.gg/WXpMxBEYYA

📌 Don't forget to verify and check out all channels!`;

const command: ICommand = {
  config: {
    name: "discord",
    description: "Get VexonSMP Discord server link",
    category: "Fun",
    hasPrefix: false,
    aliases: ["dc", "disc", "server"]
  },

  run: async ({ api, event, send }: IRunParams) => {
    await send(discordMessage);
  },

  handleChat: async ({ api, event, send }: IChatParams) => {
    const body = event.body.toLowerCase().trim();
    
    // Auto-respond when discord is mentioned
    const discordTriggers = [
      /\bdiscord\b/i,
      /\bdisc\b/i,
      /\bdc link\b/i,
      /\bdc server\b/i,
      /discord\s*link/i,
      /discord\s*server/i
    ];

    const shouldRespond = discordTriggers.some(trigger => trigger.test(body));

    if (shouldRespond && body.length < 100) {
      await send(discordMessage);
    }
  }
};

export = command;
