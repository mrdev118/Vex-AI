import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { EXTERNAL_API_KEY, EXTERNAL_API_URL } from '../../src/config';
import { ICommand, IRunParams } from '../../types';

const saveTempImage = (base64Data: string): string => {
  const buffer = Buffer.from(base64Data, 'base64');
  const tmpFile = path.join(os.tmpdir(), `aiimg_${Date.now()}.png`);
  fs.writeFileSync(tmpFile, buffer);
  return tmpFile;
};

const command: ICommand = {
  config: {
    name: 'aiimg',
    version: '2.0.0',
    author: 'Vex Team',
    description: 'Generate an image using backend AI',
    category: 'AI',
    usages: '.aiimg <prompt>',
    aliases: ['imagine', 'nano']
  },

  run: async ({ api, event, args, send }: IRunParams) => {
    const threadID = event.threadID;

    if (!EXTERNAL_API_URL || !EXTERNAL_API_KEY) {
      await send('❌ External API is not configured. Please set externalApi.url and externalApi.key in config.json.');
      return;
    }

    const prompt = args.join(' ').trim();
    if (!prompt) {
      await send('Please provide an image prompt. Example: .aiimg a serene Japanese garden with cherry blossoms');
      return;
    }

    try {
      await api.sendTypingIndicator(threadID);

      const response = await axios.post(
        `${EXTERNAL_API_URL}/api/v1/vdgai`,
        { prompt },
        {
          headers: {
            'X-API-Key': EXTERNAL_API_KEY,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Content-Type': 'application/json'
          },
          timeout: 120000,
          responseType: 'arraybuffer'
        }
      );

      const buffer = Buffer.from(response.data);
      if (!buffer || buffer.length === 0) {
        await send('❌ Could not decode image from AI response.');
        return;
      }

      const filePath = saveTempImage(buffer.toString('base64'));

      await api.sendMessage(
        {
          body: `🖼️ Prompt: ${prompt}`,
          attachment: fs.createReadStream(filePath)
        },
        threadID,
        () => {
          try {
            fs.unlinkSync(filePath);
          } catch {
            /* ignore */
          }
        }
      );
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401) {
        await send('❌ Unauthorized: External AI rejected the request.');
      } else if (status === 429) {
        await send('⚠️ Rate limit reached. Please wait and try again.');
      } else if (error.code === 'ECONNABORTED') {
        await send('⏱️ Request timed out. Please try again.');
      } else {
        const detail = error?.response?.data?.error || error?.message || 'Unknown error';
        await send(`❌ AI image error: ${detail}`);
      }
    }
  }
};

export = command;
