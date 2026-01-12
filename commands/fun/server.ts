import { ICommand, IRunParams } from '../../types';
import { getBedrockServerStatus } from '../../src/utils/serverStatus';

const SERVER_HOST = 'vexonsmp.sereinhost.com';
const SERVER_PORT = 25581;

const formatStatusMessage = (status: Awaited<ReturnType<typeof getBedrockServerStatus>>): string => {
  if (status.online) {
    const players = status.players ? `${status.players.online}/${status.players.max}` : 'Unknown';
    const lines = [
      '𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 𝗦𝗲𝗿𝘃𝗲𝗿 𝗦𝘁𝗮𝘁𝘂𝘀',
      '',
      '✅ Status: ONLINE',
      `👥 Players: ${players}`,
      `📡 IP: ${SERVER_HOST}:${SERVER_PORT}`,
      `🎮 Version: ${status.version || 'Unknown'}`
    ];

    if (status.motd) {
      lines.splice(2, 0, `📝 MOTD: ${status.motd}`);
    }

    lines.push(status.players && status.players.online > 0
      ? '🔥 Server is active! Join now!'
      : '💤 No players online. Be the first!');

    return lines.join('\n');
  }

  const offlineLines = [
    '𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 𝗦𝗲𝗿𝘃𝗲𝗿 𝗦𝘁𝗮𝘁𝘂𝘀',
    '',
    '❌ Status: OFFLINE',
    `📡 IP: ${SERVER_HOST}:${SERVER_PORT}`
  ];

  if (status.error) {
    offlineLines.push(`⚠️ Error: ${status.error}`);
  }

  return offlineLines.join('\n');
};

const command: ICommand = {
  config: {
    name: "server",
    hasPrefix: true,
    description: "Check VexonSMP Minecraft server status",
    category: "Fun",
    usages: "server",
    aliases: ["status", "online", "list", "players", "playerlist"]
  },

  run: async ({ api, event, send }: IRunParams): Promise<void> => {
    await send("🔄 Checking server status...");

    try {
      const status = await getBedrockServerStatus(SERVER_HOST, SERVER_PORT);
      await send(formatStatusMessage(status));
    } catch (error) {
      await send('❌ Failed to check server status. Please try again later.');
    }
  }
};

export = command;
