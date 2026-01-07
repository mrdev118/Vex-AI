import { ICommand, IRunParams } from '../../types';

const command: ICommand = {
  config: {
    name: "ip",
    description: "Send server IP",
    category: "Fun",
    hasPrefix: false
  },

  run: async ({ api, event, send }: IRunParams) => {
    await send("𝗦𝗘𝗥𝗩𝗘𝗥 𝗡𝗔𝗠𝗘:\nVexonSMP\n\n𝗦𝗘𝗥𝗩𝗘𝗥 𝗔𝗗𝗗𝗥𝗘𝗦𝗦:\nvexonsmp.sereinhost.com\n\n𝗦𝗘𝗥𝗩𝗘𝗥 𝗣𝗢𝗥𝗧:\n25581");
  }
};

export = command;
