import { ICommand, IRunParams } from '../../types';

const serverMessage = "𝗦𝗘𝗥𝗩𝗘𝗥 𝗡𝗔𝗠𝗘:\nVexonSMP\n\n𝗦𝗘𝗥𝗩𝗘𝗥 𝗔𝗗𝗗𝗥𝗘𝗦𝗦:\nvexonsmp.sereinhost.com\n\n𝗦𝗘𝗥𝗩𝗘𝗥 𝗣𝗢𝗥𝗧:\n25581";

const command: ICommand = {
  config: {
    name: "ip",
    description: "Send server IP",
    category: "Utility",
    hasPrefix: false,
    aliases: ["serverip", "address", "serverinfo", "connect", "join"]
  },

  run: async ({ api, event, send }: IRunParams) => {
    await send(serverMessage);
  },

  handleChat: async ({ api, event, send }) => {
    // Automatically send IP if message contains "ip" (case-insensitive)
    if (event.body && event.body.toLowerCase().includes("ip")) {
      await send(serverMessage);
    }
  }
};

export = command;
