import type { IFCAU_API } from '@dongdev/fca-unofficial';
import { ICommand, MessageEventType } from '../../types';
import { client } from '../client';
import { logger } from '../utils/logger';
import { Users } from '../../database/controllers/userController';
import { Threads } from '../../database/controllers/threadController';
import { createMessageHelper } from '../utils/message';

export const handleChat = async (
  api: IFCAU_API,
  event: MessageEventType
): Promise<void> => {
  const firstWord = (event.body || '').trim().split(/\s+/)[0]?.toLowerCase() || '';
  const processedCommands = new Set<ICommand>();
  for (const command of [...client.commands.values(), ...client.noprefix.values()]) {
    if (command.handleChat && !processedCommands.has(command)) {
      // Skip handleChat when the same noprefix keyword would trigger the command run,
      // preventing double replies (e.g., message "bot" running both run + handleChat).
      if (command.config.hasPrefix === false) {
        const aliases = Array.isArray(command.config.aliases) ? command.config.aliases.map(a => a.toLowerCase()) : [];
        const names = [command.config.name.toLowerCase(), ...aliases];
        if (names.includes(firstWord)) {
          processedCommands.add(command);
          continue;
        }
      }

      processedCommands.add(command);
      try {
        const messageHelper = createMessageHelper(api, event);
        await command.handleChat({
          api,
          event,
          config: command.config,
          Users,
          Threads,
          send: messageHelper.send,
          reply: messageHelper.reply,
          react: messageHelper.react
        });
      } catch (error) {
        logger.error(`Error handleChat in command ${command.config.name}:`, error);
      }
    }
  }
};
