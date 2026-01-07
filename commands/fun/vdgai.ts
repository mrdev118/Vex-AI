import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { ICommand, IRunParams } from '../../types';
import { EXTERNAL_API_URL, EXTERNAL_API_KEY } from '../../src/config';

const command: ICommand = {
  config: {
    name: "vdgai",
    version: "1.0.0",
    author: "Hyun Su",
    description: "Generate AI images with VDG AI",
    category: "AI",
    usages: ".vdgai <prompt>",
    aliases: ["vdg", "imagine"]
  },

  run: async ({ api, event, args, send }: IRunParams) => {
    const threadID = event.threadID;
    const messageID = event.messageID;

    if (args.length === 0) {
      await send("Please provide an image prompt!\n\nUsage: .vdgai <prompt>\n\nExample: .vdgai a beautiful sunset over mountains");
      return;
    }

    try {
      await api.sendTypingIndicator(threadID);

      const prompt = args.join(' ');

      // Make API request
      const apiResponse = await axios.post(
        `${EXTERNAL_API_URL}/api/v1/vdgai`,
        {
          prompt: prompt
        },
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

      if (apiResponse.data) {
        // Save image temporarily
        const tempDir = path.join(__dirname, '../../../temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempFile = path.join(tempDir, `vdgai_${Date.now()}.png`);
        fs.writeFileSync(tempFile, apiResponse.data);

        // Send image
        const message = {
          body: `🎨 VDG AI Image\n📝 Prompt: ${prompt}`,
          attachment: fs.createReadStream(tempFile)
        };

        api.sendMessage(message, threadID, (err) => {
          // Clean up temp file
          try {
            fs.unlinkSync(tempFile);
          } catch (e) {}
        }, messageID);
      } else {
        await send("❌ Failed to generate image. Please try again.");
      }

    } catch (error: any) {
      console.error('VDG AI Error:', error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        await send("❌ API authentication failed. Please check the API key.");
      } else if (error.response?.status === 429) {
        await send("⚠️ Rate limit reached. Please wait a moment and try again.");
      } else if (error.code === 'ECONNABORTED') {
        await send("⏱️ Request timeout. The AI is taking too long to respond. Please try again.");
      } else {
        await send(`❌ Error: ${error.response?.data?.error || error.message || 'Failed to communicate with VDG AI'}`);
      }
    }
  }
};

export = command;
