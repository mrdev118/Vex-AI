import { ICommand, IRunParams } from '../../types';
import { ADMIN_IDS, BOT_NAME, OWNER_ID, PREFIX } from '../../src/config';
import * as dgram from 'dgram';

const SERVER_HOST = 'vexonsmp.sereinhost.com';
const SERVER_PORT = 25581;

interface BedrockServerStatus {
  online: boolean;
  motd?: string;
  players?: number;
  maxPlayers?: number;
  version?: string;
  error?: string;
}

const queryBedrockServer = (host: string, port: number): Promise<BedrockServerStatus> => {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const timeout = setTimeout(() => {
      socket.close();
      resolve({ online: false, error: 'Server timeout' });
    }, 5000);

    const pingPacket = Buffer.from([
      0x01,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0xff, 0xff, 0x00, 0xfe, 0xfe, 0xfe, 0xfe, 0xfd, 0xfd, 0xfd, 0xfd, 0x12, 0x34, 0x56, 0x78,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);

    socket.on('message', (msg) => {
      clearTimeout(timeout);
      socket.close();

      try {
        const response = msg.toString('utf-8');
        const parts = response.split(';');

        if (parts.length >= 7) {
          resolve({
            online: true,
            motd: parts[1] || 'Unknown',
            players: parseInt(parts[4]) || 0,
            maxPlayers: parseInt(parts[5]) || 0,
            version: parts[3] || 'Unknown'
          });
        } else {
          resolve({ online: false, error: 'Invalid response' });
        }
      } catch (error) {
        resolve({ online: false, error: 'Parse error' });
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      socket.close();
      resolve({ online: false, error: err.message });
    });

    socket.send(pingPacket, port, host);
  });
};

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
        queryBedrockServer(SERVER_HOST, SERVER_PORT),
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
        serverSection = [
          '🛰️ Server: ONLINE',
          `👥 Players: ${serverStatus.players}/${serverStatus.maxPlayers}`,
          `📡 Address: ${SERVER_HOST}:${SERVER_PORT}`,
          `🗒️ MOTD: ${serverStatus.motd}`,
          `🧭 Version: ${serverStatus.version}`
        ].join('\n');
      } else if (serverStatus.error) {
        serverSection = `🛰️ Server: OFFLINE\n⚠️ ${serverStatus.error}\n📡 Address: ${SERVER_HOST}:${SERVER_PORT}`;
      }

      const adminsLine = adminNames.length > 0 ? adminNames.join(', ') : 'None';

      const message = `━━━━ VEXON SNAPSHOT ━━━━\n` +
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
