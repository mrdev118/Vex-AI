import { ICommand, IRunParams, IChatParams } from '../../types';
import { PREFIX } from '../../src/config';
import { getBedrockServerStatus } from '../../src/utils/serverStatus';

const SERVER_HOST = "vexonsmp.sereinhost.com";
const SERVER_PORT = 25581;

const formatStatusMessage = (status: Awaited<ReturnType<typeof getBedrockServerStatus>>): string => {
  const statusLine = status.online ? "🟢 ONLINE" : "🔴 OFFLINE";
  const playersLine = status.players ? `${status.players.online}/${status.players.max}` : 'Unknown';
  const versionLine = status.version || 'Unknown';
  const footer = status.online ? '🔥 Server is active! Join now!' : '⚠️ Server appears offline. Try again soon.';

  return [
    '𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 𝗦𝗲𝗿𝘃𝗲𝗿 𝗦𝘁𝗮𝘁𝘂𝘀',
    '',
    `✅ Status: ${statusLine}`,
    `👥 Players: ${playersLine}`,
    `📡 IP: ${SERVER_HOST}:${SERVER_PORT}`,
    `🎮 Version: ${versionLine}`,
    '',
    footer
  ].join('\n');
};

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
    await send(formatStatusMessage(status));
  },

  handleChat: async ({ event, send }: IChatParams) => {
    const body = event.body || '';
    if (!body.trim()) return;

    // Avoid double replies when user intentionally calls the prefixed command.
    if (PREFIX && body.trim().startsWith(PREFIX)) return;

    // Reply when "ip" appears anywhere in the message.
    if (!/\bip\b/i.test(body)) return;

    const status = await getBedrockServerStatus(SERVER_HOST, SERVER_PORT);
    await send(formatStatusMessage(status));
  }
};

export = command;
