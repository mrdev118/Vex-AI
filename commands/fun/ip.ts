import { ICommand, IRunParams } from '../../types';
import { getBedrockServerStatus } from '../../src/utils/serverStatus';

const SERVER_HOST = "vexonsmp.sereinhost.com";
const SERVER_PORT = 25581;

const command: ICommand = {
  config: {
    name: "ip",
    description: "Send server IP and check status",
    category: "Utility",
    hasPrefix: false,
    aliases: ["serverip", "address", "serverinfo", "connect", "join"]
  },

  run: async ({ send }: IRunParams) => {
    const status = await getBedrockServerStatus(SERVER_HOST, SERVER_PORT);

    let message = "𝗦𝗘𝗥𝗩𝗘𝗥 𝗡𝗔𝗠𝗘:\nVexonSMP\n\n";
    message += "𝗦𝗘𝗥𝗩𝗘𝗥 𝗔𝗗𝗗𝗥𝗘𝗦𝗦:\nvexonsmp.sereinhost.com\n\n";
    message += "𝗦𝗘𝗥𝗩𝗘𝗥 𝗣𝗢𝗥𝗧:\n25581\n\n";

    if (status.online) {
      message += "𝗦𝗧𝗔𝗧𝗨𝗦: 🟢 𝗢𝗡𝗟𝗜𝗡𝗘";
      if (status.players) {
        message += `\n𝗣𝗟𝗔𝗬𝗘𝗥𝗦: ${status.players.online}/${status.players.max}`;
      }
      if (status.version) {
        message += `\n𝗩𝗘𝗥𝗦𝗜𝗢𝗡: ${status.version}`;
      }
      if (status.motd) {
        message += `\n𝗠𝗢𝗧𝗗: ${status.motd}`;
      }
    } else {
      message += "𝗦𝗧𝗔𝗧𝗨𝗦: 🔴 𝗢𝗙𝗙𝗟𝗜𝗡𝗘";
      if (status.error) {
        message += `\n𝗘𝗥𝗥𝗢𝗥: ${status.error}`;
      }
    }

    await send(message);
  }
};

export = command;
