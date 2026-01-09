import type { IFCAU_API } from '@dongdev/fca-unofficial';
import { Threads } from '../../database/controllers/threadController';
import { Users } from '../../database/controllers/userController';
import { CommandEventType } from '../../types';
import { client } from '../client';
import { botConfig, isOwner } from '../config';
import { logger } from '../utils/logger';
import { createMessageHelper } from '../utils/message';
import { hasPermission } from '../utils/permissions';
import { checkCommandPermission, ownerNoPrefixAllowed } from '../utils/permissionsExtended';
import { checkFunCooldown, getFunCooldownMs } from '../utils/cooldown';

export const handleNoPrefixCommand = async (
  api: IFCAU_API,
  event: CommandEventType,
  body: string
): Promise<void> => {
  const isOwnerUser = isOwner(event.senderID);
  const parts = body.trim().split(/\s+/);
  const inCmd = parts.shift()?.toLowerCase() || '';

  // Get command by name or alias (but not both to avoid duplicates)
  const command = client.noprefix.get(inCmd);

  if (!command) {
    logger.debug(`No noprefix command found for: ${inCmd}`);
    return;
  }

  logger.debug(`Found noprefix command: ${command.config.name} for input: ${inCmd}`);

  const canNoPrefix = command.config.hasPrefix === false ||
    ownerNoPrefixAllowed(command, botConfig.ownerNoPrefix, isOwnerUser);

  if (!canNoPrefix) {
    logger.debug(`Command ${command.config.name} cannot run as noprefix`);
    return;
  }

  try {
    const isFunCategory = (command.config.category || '').toLowerCase() === 'fun';
    if (isFunCategory && !isOwnerUser) {
      const cooldownCheck = checkFunCooldown(event.senderID);
      if (!cooldownCheck.allowed) {
        const messageHelper = createMessageHelper(api, event);
        await messageHelper.send(
          `⏳ Fun commands have a ${getFunCooldownMs() / 1000}s cooldown. Please wait ${Math.ceil(cooldownCheck.waitMs / 1000)}s.`
        );
        return;
      }
    }

    const permCheck = await checkCommandPermission(api, command, event, {
      adminOnly: botConfig.adminOnly,
      adminBox: botConfig.adminBox,
      antiINBOX: botConfig.antiINBOX
    });

    if (!permCheck.allowed) {
      const messageHelper = createMessageHelper(api, event);
      await messageHelper.send(permCheck.reason || '❌ You do not have permission to use this command!');
      return;
    }

    const requiredRole = command.config.role ?? 0;
    const hasAccess = await hasPermission(api, event.senderID, event, requiredRole);

    if (!hasAccess) {
      const roleNames = ['User', 'Group Admin', 'Bot Admin', 'Owner'];
      const messageHelper = createMessageHelper(api, event);
      await messageHelper.send(
        `❌ You do not have permission to use this command!\n` +
        `Required: ${roleNames[requiredRole]} (${requiredRole})`
      );
      return;
    }

    const args = parts;
    const messageHelper = createMessageHelper(api, event);
    await command.run({
      api,
      event,
      args,
      name: inCmd,
      config: command.config,
      Users,
      Threads,
      send: messageHelper.send,
      reply: messageHelper.reply,
      react: messageHelper.react
    });
  } catch (error) {
    if (error instanceof Error && !error.message.includes('skip')) {
      logger.error(`Error running noprefix ${inCmd}:`, error);
    }
  }
};
