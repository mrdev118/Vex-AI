import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ICommand, IRunParams } from '../../types';

const PUTER_TXT2IMG_URL = 'https://api.puter.com/v2/ai/txt2img';
const IMAGE_MODEL = 'gemini-2.5-flash-image-preview';

const saveTempImage = (base64Data: string): string => {
  const buffer = Buffer.from(base64Data, 'base64');
  const tmpFile = path.join(os.tmpdir(), `aiimg_${Date.now()}.png`);
  fs.writeFileSync(tmpFile, buffer);
  return tmpFile;
};

const extractBase64 = (data: any): string | null => {
  if (!data) return null;
  if (typeof data === 'string') {
    // Accept data URLs or plain base64 strings
    if (data.startsWith('data:image')) {
      const comma = data.indexOf(',');
      return comma >= 0 ? data.slice(comma + 1) : null;
    }
    return data;
  }

  return (
    data.image ||
    (Array.isArray(data.images) && data.images[0]) ||
    data.result?.image ||
    data.output ||
    null
  );
};

const command: ICommand = {
  config: {
    name: 'aiimg',
    version: '1.0.0',
    author: 'Vex Team',
    description: 'Generate an image using Puter AI (Gemini)',
    category: 'AI',
    usages: '.aiimg <prompt>',
    aliases: ['imagine', 'nano']
  },

  run: async ({ api, event, args, send }: IRunParams) => {
    const threadID = event.threadID;

    const prompt = args.join(' ').trim();
    if (!prompt) {
      await send('Please provide an image prompt. Example: .aiimg a serene Japanese garden with cherry blossoms');
      return;
    }

    try {
      await api.sendTypingIndicator(threadID);

      const payload = {
        model: IMAGE_MODEL,
        prompt
      };

      const response = await axios.post(PUTER_TXT2IMG_URL, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 120000
      });

      const base64 = extractBase64(response.data);
      if (!base64) {
        await send('❌ Could not decode image from AI response.');
        return;
      }

      const filePath = saveTempImage(base64.replace(/^data:image\/[^;]+;base64,/, ''));

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
        await send('❌ Unauthorized: Puter AI rejected the request.');
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
