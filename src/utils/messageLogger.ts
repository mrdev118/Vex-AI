import type { IFCAU_API } from '@dongdev/fca-unofficial';
import { MessageEventType } from '../../types';

interface MessageLogConfig {
  showAttachments: boolean;
  showMentions: boolean;
  truncateLength: number;
}

class MessageLogger {
  private config: MessageLogConfig;
  private nameCache: Map<string, string> = new Map();

  constructor(config?: Partial<MessageLogConfig>) {
    this.config = {
      showAttachments: true,
      showMentions: true,
      truncateLength: 200,
      ...config
    };
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  private formatThreadType(isGroup: boolean): string {
    return isGroup ? '👥 GC' : '💬 DM';
  }

  private formatAttachments(event: MessageEventType): string {
    if (!this.config.showAttachments || !event.attachments?.length) return '';
    
    const types = event.attachments.map(att => {
      switch (att.type) {
        case 'photo': return '🖼️ Photo';
        case 'video': return '🎥 Video';
        case 'audio': return '🎵 Audio';
        case 'file': return '📎 File';
        case 'sticker': return '😊 Sticker';
        case 'animated_image': return '🎞️ GIF';
        default: return `📌 ${att.type}`;
      }
    });
    
    return types.length > 0 ? ` [${types.join(', ')}]` : '';
  }

  private formatMentions(event: MessageEventType): string {
    if (!this.config.showMentions || !event.mentions || Object.keys(event.mentions).length === 0) {
      return '';
    }
    
    const mentionCount = Object.keys(event.mentions).length;
    return ` [@${mentionCount} mentioned]`;
  }

  async logMessage(api: IFCAU_API, event: MessageEventType): Promise<void> {
    try {
      // Get sender name
      let senderName = this.nameCache.get(event.senderID);
      if (!senderName) {
        try {
          const userInfo = await api.getUserInfo(event.senderID);
          senderName = userInfo[event.senderID]?.name || event.senderID;
          this.nameCache.set(event.senderID, senderName);
        } catch {
          senderName = event.senderID;
        }
      }

      // Get thread name for group chats
      let threadName = '';
      if (event.isGroup) {
        try {
          const threadInfo = await api.getThreadInfo(event.threadID);
          threadName = threadInfo.threadName || event.threadID;
        } catch {
          threadName = event.threadID;
        }
      }

      // Build the log message
      const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
      
      const threadType = this.formatThreadType(event.isGroup);
      const threadDisplay = event.isGroup ? ` in "${threadName}"` : '';
      const attachments = this.formatAttachments(event);
      const mentions = this.formatMentions(event);
      const messageBody = event.body ? this.truncate(event.body, this.config.truncateLength) : '<no text>';

      // Color codes
      const cyan = '\x1b[36m';
      const green = '\x1b[32m';
      const yellow = '\x1b[33m';
      const blue = '\x1b[34m';
      const magenta = '\x1b[35m';
      const reset = '\x1b[0m';
      const bold = '\x1b[1m';
      const dim = '\x1b[2m';

      // Format the output
      console.log(`${dim}────────────────────────────────────────────────────────────────${reset}`);
      console.log(`${cyan}[${timestamp}]${reset} ${threadType}${threadDisplay}`);
      console.log(`${green}${bold}${senderName}${reset}${dim} (${event.senderID})${reset}${mentions}${attachments}`);
      console.log(`${blue}│${reset} ${messageBody}`);
      console.log(`${dim}────────────────────────────────────────────────────────────────${reset}`);
    } catch (error) {
      // Silently fail - don't disrupt message processing
      console.error('Error logging message:', error);
    }
  }

  setConfig(config: Partial<MessageLogConfig>): void {
    this.config = { ...this.config, ...config };
  }

  clearCache(): void {
    this.nameCache.clear();
  }
}

export const messageLogger = new MessageLogger({
  showAttachments: true,
  showMentions: true,
  truncateLength: 200
});

export { MessageLogger };
export type { MessageLogConfig };
