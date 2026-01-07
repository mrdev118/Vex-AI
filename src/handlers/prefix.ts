import type { IFCAU_API } from '@dongdev/fca-unofficial';
import { MessageEventType } from '../../types';
import { client } from '../client';
import { PREFIX, botConfig, DISABLED_COMMANDS } from '../config';
import { logger } from '../utils/logger';
import { Users } from '../../database/controllers/userController';
import { Threads } from '../../database/controllers/threadController';
import { createMessageHelper } from '../utils/message';
import { hasPermission } from '../utils/permissions';
import { checkCommandPermission } from '../utils/permissionsExtended';
import { createMessageHelper as createHelper } from '../utils/message';

export const handlePrefixCommand = async (
  api: IFCAU_API,
  event: MessageEventType,
  body: string
): Promise<boolean> => {
  if (!body.startsWith(PREFIX)) return false;

  const args = body.slice(PREFIX.length).trim().split(/ +/);
  const commandName = args.shift()?.toLowerCase();

  if (!commandName) return false;

  const command = client.commands.get(commandName);

  if (command) {
    try {
      const permCheck = await checkCommandPermission(api, command, event, {
        adminOnly: botConfig.adminOnly,
        adminBox: botConfig.adminBox,
        antiINBOX: botConfig.antiINBOX
      });

      if (!permCheck.allowed) {
        const messageHelper = createHelper(api, event);
        await messageHelper.send(permCheck.reason || '❌ You do not have permission to use this command!');
        return true;
      }

      const requiredRole = command.config.role ?? 0;
      const hasAccess = await hasPermission(api, event.senderID, event, requiredRole);

      if (!hasAccess) {
        const roleNames = ['User', 'Group Admin', 'Bot Admin', 'Owner'];
        const messageHelper = createHelper(api, event);
        await messageHelper.send(
          `❌ You do not have permission to use this command!\n` +
          `Required: ${roleNames[requiredRole]} (${requiredRole})`
        );
        return true;
      }

      const messageHelper = createMessageHelper(api, event);
      await command.run({
        api,
        event,
        args,
        name: commandName,
        config: command.config,
        Users,
        Threads,
        send: messageHelper.send,
        reply: messageHelper.reply,
        react: messageHelper.react
      });
      logger.debug(`Executed: ${commandName} by ${event.senderID}`);
      return true;
    } catch (error) {
      logger.error(`Error running command ${commandName}:`, error);
      const messageHelper = createHelper(api, event);
      await messageHelper.send("⚠️ An error occurred while executing this command.");
      return true;
    }
  } else {
    // Don't show error message for disabled commands
    if (DISABLED_COMMANDS.includes(commandName)) {
      return false;
    }
    api.sendMessage(`❓ Command not found "${commandName}". Use ${PREFIX}help to view the list.`, event.threadID);
    return true;
  }
};
