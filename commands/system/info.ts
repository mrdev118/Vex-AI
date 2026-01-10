import { ICommand, IRunParams } from '../../types';
import { ADMIN_IDS, BOT_NAME, OWNER_ID, PREFIX } from '../../src/config';
import { getBedrockServerStatus } from '../../src/utils/serverStatus';

const SERVER_HOST = 'vexonsmp.sereinhost.com';
const SERVER_PORT = 25581;

const getThreadInfo = (api: any, threadID: string): Promise<any | null> => {
  return new Promise((resolve) => {
    api.getThreadInfo(threadID, (err: Error | null, info: any) => {
      if (err) return resolve(null);
      resolve(info);
    });
  });
};

const getUserNames = (api: any, ids: string[]) => {
  return new Promise<Record<string, string>>((resolve) => {
    if (ids.length === 0) {
      resolve({});
      return;
    }

    api.getUserInfo(ids, (err: Error | null, info: Record<string, { name?: string }>) => {
      if (err || !info) {
        resolve({});
        return;
      }

      const names: Record<string, string> = {};
      ids.forEach(id => {
        names[id] = info[id]?.name || 'Unknown';
      });
      resolve(names);
    });
  });
};

const command: ICommand = {
  config: {
    name: "info",
    version: "2.0.0",
    author: "Donix & Vex AI",
    description: "Group and server snapshot",
    category: "System"
  },

  run: async ({ api, event }: IRunParams) => {
    const threadID = (event as any)?.threadID;
    const isGroup = Boolean((event as any)?.isGroup);

    try {
      const [threadInfoRaw, serverStatus, ownerAdminNames] = await Promise.all([
        isGroup ? getThreadInfo(api, threadID) : Promise.resolve(null),
        getBedrockServerStatus(SERVER_HOST, SERVER_PORT),
        getUserNames(api, [OWNER_ID, ...ADMIN_IDS])
      ]);

      const threadInfo = threadInfoRaw as any;

      const ownerName = ownerAdminNames[OWNER_ID] || 'Unknown';
      const adminNames = ADMIN_IDS.map(id => ownerAdminNames[id] || 'Unknown');

      const groupSection = isGroup && threadInfo
        ? `🏠 Group: ${threadInfo.threadName || 'Unknown room'}\n👥 Members: ${(threadInfo.participantIDs || []).length}\n🛡️ Group Admins: ${(threadInfo.adminIDs || []).length}\n📌 Thread ID: ${threadID}`
        : '🏠 Group: Direct message';

      let serverSection = '🛰️ Server: OFFLINE';
      if (serverStatus.online) {
        const playersLine = serverStatus.players
          ? `👥 Players: ${serverStatus.players.online}/${serverStatus.players.max}`
          : '👥 Players: Unknown';

        serverSection = [
          '🛰️ Server: ONLINE',
          playersLine,
          `📡 Address: ${SERVER_HOST}:${SERVER_PORT}`,
          serverStatus.motd ? `🗒️ MOTD: ${serverStatus.motd}` : undefined,
          serverStatus.version ? `🧭 Version: ${serverStatus.version}` : undefined
        ].filter(Boolean).join('\n');
      } else if (serverStatus.error) {
        serverSection = `🛰️ Server: OFFLINE\n⚠️ ${serverStatus.error}\n📡 Address: ${SERVER_HOST}:${SERVER_PORT}`;
      }

      const adminsLine = adminNames.length > 0 ? adminNames.join(', ') : 'None';

      const message = `**VexonSMP Information**\n` +
        `👑 Owner: ${ownerName} (${OWNER_ID})\n` +
        `🛠️ Admins: ${adminsLine}\n` +
        `${groupSection}\n\n` +
        `${serverSection}\n\n` +
        `🤖 Bot: ${BOT_NAME}\n` +
        `⌨️ Prefix: ${PREFIX}`;

      api.sendMessage(message, threadID);
    } catch (error) {
      api.sendMessage('❌ Failed to build info. Please try again later.', threadID);
    }
  }
};

export = command;
