import * as net from 'net';
import * as dgram from 'dgram';

export interface JavaServerStatus {
  online: boolean;
  motd?: string;
  players?: { online: number; max: number };
  version?: string;
  error?: string;
}

export interface BedrockServerStatus {
  online: boolean;
  motd?: string;
  players?: { online: number; max: number };
  version?: string;
  error?: string;
}

const PROTOCOL_VERSION = 760; // General protocol version for status query

const writeVarInt = (value: number): Buffer => {
  const bytes: number[] = [];
  let temp = value >>> 0;

  do {
    let byte = temp & 0x7f;
    temp >>>= 7;
    if (temp !== 0) {
      byte |= 0x80;
    }
    bytes.push(byte);
  } while (temp !== 0);

  return Buffer.from(bytes);
};

const readVarInt = (buffer: Buffer, offset: number) => {
  let num = 0;
  let numRead = 0;
  let byte = 0;

  do {
    if (offset + numRead >= buffer.length) {
      return null;
    }

    byte = buffer[offset + numRead];
    num |= (byte & 0x7f) << (7 * numRead);
    numRead += 1;

    if (numRead > 5) {
      throw new Error('VarInt too big');
    }
  } while ((byte & 0x80) !== 0);

  return { value: num, size: numRead } as const;
};

const buildHandshakePacket = (host: string, port: number): Buffer => {
  const hostBuf = Buffer.from(host, 'utf8');
  const data = Buffer.concat([
    writeVarInt(PROTOCOL_VERSION),
    writeVarInt(hostBuf.length),
    hostBuf,
    Buffer.from([(port >> 8) & 0xff, port & 0xff]),
    writeVarInt(1) // Next state: status
  ]);

  return Buffer.concat([
    writeVarInt(1 + data.length),
    writeVarInt(0x00), // Handshake packet ID
    data
  ]);
};

const buildStatusRequestPacket = (): Buffer => Buffer.concat([writeVarInt(1), writeVarInt(0x00)]);

const tryParseStatusResponse = (buffer: Buffer) => {
  let offset = 0;

  const packetLength = readVarInt(buffer, offset);
  if (!packetLength) return null;
  offset += packetLength.size;

  if (buffer.length < offset + packetLength.value) {
    return null;
  }

  const packetId = readVarInt(buffer, offset);
  if (!packetId) return null;
  offset += packetId.size;

  if (packetId.value !== 0x00) {
    return null;
  }

  const jsonLength = readVarInt(buffer, offset);
  if (!jsonLength) return null;
  offset += jsonLength.size;

  if (buffer.length < offset + jsonLength.value) {
    return null;
  }

  const jsonString = buffer.subarray(offset, offset + jsonLength.value).toString('utf8');

  try {
    return JSON.parse(jsonString);
  } catch (err) {
    return null;
  }
};

export const getJavaServerStatus = (
  host: string,
  port: number,
  timeoutMs = 5000
): Promise<JavaServerStatus> => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let buffer = Buffer.alloc(0);
    let resolved = false;

    const finish = (status: JavaServerStatus) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      socket.destroy();
      resolve(status);
    };

    const timeout = setTimeout(() => {
      finish({ online: false, error: 'Timeout' });
    }, timeoutMs);

    socket.once('error', (err) => {
      finish({ online: false, error: err.message });
    });

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      const response = tryParseStatusResponse(buffer);
      if (response) {
        finish({
          online: true,
          motd: response.description?.text || response.description || undefined,
          players: response.players
            ? { online: response.players.online ?? 0, max: response.players.max ?? 0 }
            : undefined,
          version: response.version?.name
        });
      }
    });

    socket.once('close', () => {
      if (!resolved) {
        finish({ online: false, error: 'Connection closed' });
      }
    });

    socket.connect(port, host, () => {
      socket.write(buildHandshakePacket(host, port));
      socket.write(buildStatusRequestPacket());
    });
  });
};

export const getBedrockServerStatus = (
  host: string,
  port: number,
  timeoutMs = 5000
): Promise<BedrockServerStatus> => {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    let finished = false;

    const finish = (status: BedrockServerStatus) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      socket.close();
      resolve(status);
    };

    const timeout = setTimeout(() => {
      finish({ online: false, error: 'Timeout' });
    }, timeoutMs);

    socket.once('error', (err) => {
      finish({ online: false, error: err.message });
    });

    socket.on('message', (msg) => {
      try {
        const response = msg.toString('utf8');
        const parts = response.split(';');

        if (parts.length >= 6) {
          const online = parseInt(parts[4], 10);
          const max = parseInt(parts[5], 10);

          finish({
            online: true,
            motd: parts[1] || undefined,
            players: {
              online: Number.isNaN(online) ? 0 : online,
              max: Number.isNaN(max) ? 0 : max
            },
            version: parts[3] || undefined
          });
        } else {
          finish({ online: false, error: 'Invalid response' });
        }
      } catch (err) {
        finish({ online: false, error: (err as Error).message });
      }
    });

    // Bedrock unconnected ping packet
    const pingPacket = Buffer.from([
      0x01,
      // 8-byte timestamp (can be zeros)
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      // RakNet magic
      0x00, 0xff, 0xff, 0x00, 0xfe, 0xfe, 0xfe, 0xfe, 0xfd, 0xfd, 0xfd, 0xfd, 0x12, 0x34, 0x56, 0x78,
      // 8-byte client GUID (arbitrary)
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);

    socket.send(pingPacket, port, host, (err) => {
      if (err) {
        finish({ online: false, error: err.message });
      }
    });
  });
};
