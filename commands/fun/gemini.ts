import axios from 'axios';
import { ICommand, IRunParams, IChatParams } from '../../types';
import { EXTERNAL_API_URL, EXTERNAL_API_KEY } from '../../src/config';

const conversationHistory = new Map<string, any[]>();

const command: ICommand = {
  config: {
    name: "ai",
    version: "1.0.0",
    author:"Hyun Su",
    description: "Chat with Gemini AI - supports text and image recognition",
    category: "AI",
    usages: ".ai <message> or reply to an image with .gemini <question>",
    aliases: ["gemini", "gpt"]
  },

  run: async ({ api, event, args, send }: IRunParams) => {
    const threadID = event.threadID;
    const messageID = event.messageID;
    const eventWithReply = event as any;

    if (args.length === 0 && !eventWithReply.messageReply) {
      await send("Please provide a message or reply to an image/message!\n\nUsage:\n• .gemini <your message>\n• Reply to an image: .gemini describe this\n• Continue conversation: .gemini <follow-up question>");
      return;
    }

    try {
      await api.sendTypingIndicator(threadID);

      let userMessage = args.join(' ');
      let imageData: string | null = null;
      let history = conversationHistory.get(threadID) || [];

      // Handle message reply (for images or continuing conversation)
      if (eventWithReply.messageReply) {
        const replyMessage = eventWithReply.messageReply;
        
        // Check if reply contains an image
        if (replyMessage.attachments && replyMessage.attachments.length > 0) {
          const attachment = replyMessage.attachments[0];
          
          if (attachment.type === 'photo') {
            try {
              // Download image
              const imageUrl = attachment.url;
              const response = await axios.get(imageUrl, { 
                responseType: 'arraybuffer',
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
              });
              
              // Convert to base64
              imageData = Buffer.from(response.data, 'binary').toString('base64');
              
              if (!userMessage) {
                userMessage = "What's in this image?";
              }
            } catch (error) {
              await send("❌ Failed to process the image. Please try again.");
              return;
            }
          }
        } else if (replyMessage.body) {
          // If replying to a text message, add context
          userMessage = `Context: "${replyMessage.body}"\n\nQuestion: ${userMessage}`;
        }
      }

      // Prepare request data
      const requestData: any = {
        message: userMessage,
        history: history
      };

      if (imageData) {
        requestData.image = imageData;
      }

      // Make API request
      const apiResponse = await axios.post(
        `${EXTERNAL_API_URL}/api/v1/gemini/chat`,
        requestData,
        {
          headers: {
            'X-API-Key': EXTERNAL_API_KEY,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      if (apiResponse.data && apiResponse.data.response) {
        const geminiResponse = apiResponse.data.response;
        
        // Update conversation history
        history.push({
          role: 'user',
          parts: [{ text: userMessage }]
        });
        history.push({
          role: 'model',
          parts: [{ text: geminiResponse }]
        });

        // Keep only last 10 exchanges (20 messages)
        if (history.length > 20) {
          history = history.slice(-20);
        }
        conversationHistory.set(threadID, history);

        await send(`🤖 Gemini AI:\n\n${geminiResponse}`, messageID);
      } else {
        await send("❌ Received an invalid response from Gemini AI. Please try again.");
      }

    } catch (error: any) {
      console.error('Gemini API Error:', error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        await send("❌ API authentication failed. Please check the API key.");
      } else if (error.response?.status === 429) {
        await send("⚠️ Rate limit reached. Please wait a moment and try again.");
      } else if (error.code === 'ECONNABORTED') {
        await send("⏱️ Request timeout. The AI is taking too long to respond. Please try again.");
      } else {
        await send(`❌ Error: ${error.response?.data?.error || error.message || 'Failed to communicate with Gemini AI'}`);
      }
    }
  },

  handleChat: async ({ api, event, send }: IChatParams) => {
    if (!event.body) return;
    const body = event.body.toLowerCase().trim();
    const threadID = event.threadID;

    // Auto-respond when someone mentions "gemini" or asks AI-related questions
    const geminiTriggers = [
      /\bgemini\b/i,
      /\bai what\b/i,
      /\bai can you\b/i,
      /\bai help\b/i
    ];

    const shouldRespond = geminiTriggers.some(trigger => trigger.test(body));

    if (shouldRespond && body.length > 10 && body.length < 200) {
      try {
        await api.sendTypingIndicator(threadID);
        
        const history = conversationHistory.get(threadID) || [];
        
        const requestData = {
          message: event.body,
          history: history
        };

        const apiResponse = await axios.post(
          `${EXTERNAL_API_URL}/api/v1/gemini/chat`,
          requestData,
          {
            headers: {
              'X-API-Key': EXTERNAL_API_KEY,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Content-Type': 'application/json'
            },
            timeout: 60000
          }
        );

        if (apiResponse.data && apiResponse.data.response) {
          const geminiResponse = apiResponse.data.response;
          await send(`🤖 ${geminiResponse}`);
        }
      } catch (error) {
        // Silently fail for auto-responses
        console.error('Gemini auto-response error:', error);
      }
    }
  }
};

export = command;
