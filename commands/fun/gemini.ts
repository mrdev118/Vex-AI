import axios from 'axios';
import { ICommand, IRunParams } from '../../types';

const PUTER_CHAT_URL = 'https://api.puter.com/v2/ai/chat';
const DEFAULT_MODEL = 'gemini-3-pro-preview';
const IMAGE_MODEL = 'gemini-3-flash-preview';

const fetchImageDataUrl = async (url: string, mime: string = 'image/jpeg'): Promise<string> => {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    timeout: 30000
  });

  const base64 = Buffer.from(response.data, 'binary').toString('base64');
  return `data:${mime};base64,${base64}`;
};

const command: ICommand = {
  config: {
    name: 'ai',
    version: '3.0.0',
    author: 'Vex Team',
    description: 'Chat with Gemini via Puter AI (text + image)',
    category: 'AI',
    usages: '.ai <message> | reply to an image with .ai what is this',
    aliases: ['gemini', 'gpt']
  },

  run: async ({ api, event, args, send }: IRunParams) => {
    const threadID = event.threadID;
    const messageID = event.messageID;
    const replyMsg = (event as any).messageReply as any | undefined;

    const hasArgs = args.length > 0;
    if (!hasArgs && !replyMsg) {
      await send('Usage:\n• .ai <your message>\n• Reply to text: .ai summarize this\n• Reply to an image: .ai what is this');
      return;
    }

    let userMessage = args.join(' ').trim();
    let imageUrl: string | null = null;

    if (replyMsg && replyMsg.attachments && replyMsg.attachments.length > 0) {
      const img = replyMsg.attachments.find((a: any) => a.type === 'photo');
      if (img?.url) {
        imageUrl = img.url;
        if (!userMessage) {
          userMessage = 'What do you see in this image?';
        }
      }
    }

    if (replyMsg && replyMsg.body) {
      const base = userMessage || 'Please answer based on the replied message.';
      userMessage = `Context: "${replyMsg.body}"\n\nQuestion: ${base}`;
    }

    if (!userMessage) {
      await send('❌ Please provide a message to send to the AI.');
      return;
    }

    try {
      await api.sendTypingIndicator(threadID);

      const model = imageUrl ? IMAGE_MODEL : DEFAULT_MODEL;
      const payload: Record<string, unknown> = {
        model,
        messages: [
          {
            role: 'user',
            content: userMessage
          }
        ]
      };

      if (imageUrl) {
        const dataUrl = await fetchImageDataUrl(imageUrl);
        payload.image = dataUrl;
        payload.images = [dataUrl];
      }

      const response = await axios.post(PUTER_CHAT_URL, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });

      const botReply =
        response.data?.message?.content ||
        response.data?.choices?.[0]?.message?.content ||
        response.data?.response ||
        response.data?.output ||
        (typeof response.data === 'string' ? response.data : null);

      if (!botReply) {
        await send('❌ The AI returned an empty response. Please try again.');
        return;
      }

      await send(`🤖 ${botReply}`, messageID);
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
        await send(`❌ AI error: ${detail}`);
      }
    }
  }
};

export = command;
