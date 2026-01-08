import axios from 'axios';
import { GoogleGenAI } from '@google/genai';
import { EXTERNAL_API_KEY } from '../../src/config';
import { ICommand, IRunParams } from '../../types';

// Preserve short conversation history per thread for better context.
const conversationHistory = new Map<string, any[]>();

const GEMINI_MODEL = 'gemini-3-pro-preview';
const IMAGE_MIME_TYPE = 'image/jpeg';

const fetchImageBase64 = async (url: string): Promise<string> => {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    timeout: 30000
  });

  return Buffer.from(response.data, 'binary').toString('base64');
};

const extractResponseText = (result: any): string | null => {
  if (!result) return null;

  const textField = result.text || result?.response?.text;
  const textFromField = typeof textField === 'function' ? textField() : textField;
  if (typeof textFromField === 'string' && textFromField.trim()) {
    return textFromField.trim();
  }

  const candidates = result?.response?.candidates || result?.candidates || [];
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts;
    if (Array.isArray(parts)) {
      const combined = parts
        .map((part: any) => part?.text || '')
        .join('')
        .trim();
      if (combined) return combined;
    }
  }

  return null;
};

const command: ICommand = {
  config: {
    name: 'ai',
    version: '4.0.0',
    author: 'Vex Team',
    description: 'Chat with Gemini (text + image)',
    category: 'AI',
    usages: '.ai <message> | reply to an image with .ai what is this',
    aliases: ['gemini', 'gpt']
  },

  run: async ({ api, event, args, send }: IRunParams) => {
    const threadID = event.threadID;
    const messageID = event.messageID;
    const replyMsg = (event as any).messageReply as any | undefined;
    const apiKey = process.env.GEMINI_API_KEY || EXTERNAL_API_KEY;

    if (!apiKey) {
      await send('❌ Gemini API key is missing. Set GEMINI_API_KEY env var or externalApi.key in config.json.');
      return;
    }

    const hasArgs = args.length > 0;
    if (!hasArgs && !replyMsg) {
      await send('Usage:\n• .ai <your message>\n• Reply to text: .ai summarize this\n• Reply to an image: .ai what is this');
      return;
    }

    let userMessage = args.join(' ').trim();
    let imageBase64: string | null = null;
    let history = conversationHistory.get(threadID) || [];

    if (replyMsg && replyMsg.attachments && replyMsg.attachments.length > 0) {
      const img = replyMsg.attachments.find((a: any) => a.type === 'photo');
      if (img?.url) {
        imageBase64 = await fetchImageBase64(img.url);
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

      const client = new GoogleGenAI({ apiKey });

      const contents = [
        ...history,
        {
          role: 'user',
          parts: [
            { text: userMessage },
            ...(imageBase64
              ? [{ inlineData: { data: imageBase64, mimeType: IMAGE_MIME_TYPE } }]
              : [])
          ]
        }
      ];

      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents
      });

      const botReply = extractResponseText(response);

      if (!botReply) {
        await send('❌ The AI returned an empty response. Please try again.');
        return;
      }

      history.push({ role: 'user', parts: [{ text: userMessage }] });
      history.push({ role: 'model', parts: [{ text: botReply }] });
      if (history.length > 20) {
        history = history.slice(-20);
      }
      conversationHistory.set(threadID, history);

      await send(`🤖 ${botReply}`, messageID);
    } catch (error: any) {
      const detail = error?.response?.data?.error || error?.message || 'Unknown error';
      await send(`❌ AI error: ${detail}`);
    }
  }
};

export = command;
