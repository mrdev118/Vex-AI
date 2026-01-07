import { ICommand, IRunParams } from '../../types';
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
    const client = dgram.createSocket('udp4');
    const timeout = setTimeout(() => {
      client.close();
      resolve({ online: false, error: 'Server timeout' });
    }, 5000);

    // Bedrock unconnected ping packet
    const pingPacket = Buffer.from([
      0x01, // Packet ID for unconnected ping
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // Timestamp
      0x00, 0xff, 0xff, 0x00, 0xfe, 0xfe, 0xfe, 0xfe, 0xfd, 0xfd, 0xfd, 0xfd, 0x12, 0x34, 0x56, 0x78, // Magic
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 // Client GUID
    ]);

    client.on('message', (msg) => {
      clearTimeout(timeout);
      client.close();

      try {
        // Parse the response
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

    client.on('error', (err) => {
      clearTimeout(timeout);
      client.close();
      resolve({ online: false, error: err.message });
    });

    client.send(pingPacket, port, host);
  });
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
    const { threadID } = event;

    send("🔄 Checking server status...");

    try {
      const status = await queryBedrockServer(SERVER_HOST, SERVER_PORT);

      if (status.online) {
        let message = `𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 𝗦𝗲𝗿𝘃𝗲𝗿 𝗦𝘁𝗮𝘁𝘂𝘀\n\n`;
        message += `✅ Status: ONLINE\n`;
        message += `👥 Players: ${status.players}/${status.maxPlayers}\n`;
        message += `📡 IP: ${SERVER_HOST}:${SERVER_PORT}\n`;
        message += `🎮 Version: ${status.version}\n`;
        
        if (status.players && status.players > 0) {
          message += `\n🔥 Server is active! Join now!`;
        } else {
          message += `\n💤 No players online. Be the first!`;
        }

        api.sendMessage(message, threadID);
      } else {
        let message = `𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 𝗦𝗲𝗿𝘃𝗲𝗿 𝗦𝘁𝗮𝘁𝘂𝘀\n\n`;
        message += `❌ Status: OFFLINE\n`;
        message += `📡 IP: ${SERVER_HOST}:${SERVER_PORT}\n`;
        
        if (status.error) {
          message += `\n⚠️ Error: ${status.error}`;
        }

        api.sendMessage(message, threadID);
      }
    } catch (error) {
      send(`❌ Failed to check server status. Please try again later.`);
    }
  }
};

export = command;
