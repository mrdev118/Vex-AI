import * as fs from 'fs';
import * as path from 'path';
import { ICommand } from '../types';
import { client } from './client';
import { COMMANDS_DIR, DISABLED_COMMANDS } from './config';
import { logger } from './utils/logger';

const registerCommand = (command: ICommand, fullPath: string, dir: string): void => {
  if (!command.config || !command.config.name) return;

  const cmdNameLower = command.config.name.toLowerCase();
  const isDisabled = DISABLED_COMMANDS.includes(cmdNameLower) ||
    (Array.isArray(command.config.aliases) && command.config.aliases.some(a => DISABLED_COMMANDS.includes(a.toLowerCase())));
  if (isDisabled) {
    const category = path.relative(COMMANDS_DIR, dir).replace(/\\/g, '/') || 'root';
    const prefix = category !== 'root' ? `[${category}]` : '';
    logger.info(`${prefix} Skipping disabled command: ${command.config.name}`);
    return;
  }

  const category = path.relative(COMMANDS_DIR, dir).replace(/\\/g, '/') || 'root';
  const prefix = category !== 'root' ? `[${category}]` : '';

  const existing = client.commands.get(cmdNameLower) || client.noprefix.get(cmdNameLower);
  if (existing?.config?.aliases) {
    existing.config.aliases.forEach(alias => {
      client.commands.delete(alias.toLowerCase());
      client.noprefix.delete(alias.toLowerCase());
    });
  }

  // Clear both lowercase and original keys to avoid stale entries
  client.commands.delete(cmdNameLower);
  client.noprefix.delete(cmdNameLower);
  client.commands.delete(command.config.name);
  client.noprefix.delete(command.config.name);

  const targetMap = command.config.hasPrefix === false ? client.noprefix : client.commands;
  targetMap.set(cmdNameLower, command);

  if (command.config.aliases && Array.isArray(command.config.aliases)) {
    command.config.aliases.forEach(alias => {
      const aliasLower = alias.toLowerCase();
      const collision = targetMap.get(aliasLower);
      if (collision && collision.config.name !== command.config.name) {
        logger.warn(`${prefix} Alias "${alias}" is already used by another command, skipping`);
      } else {
        targetMap.set(aliasLower, command);
      }
    });
  }
};

export const findCommandFile = (targetName: string, dir: string = COMMANDS_DIR): string | null => {
  if (!fs.existsSync(dir)) return null;

  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      const found = findCommandFile(targetName, fullPath);
      if (found) return found;
    } else if (item.isFile() && (item.name.endsWith('.ts') || item.name.endsWith('.js'))) {
      try {
        delete require.cache[require.resolve(fullPath)];
        const command: ICommand = require(fullPath);
        if (command.config?.name?.toLowerCase() === targetName.toLowerCase()) {
          return fullPath;
        }
      } catch (error) {
      }
    }
  }
  return null;
};

export const loadSingleCommand = (commandName: string): { success: boolean; message: string } => {
  const filePath = findCommandFile(commandName);

  if (!filePath) {
    return { success: false, message: `❌ Command file not found: "${commandName}"` };
  }

  try {
    delete require.cache[require.resolve(filePath)];
    const command: ICommand = require(filePath);

    if (!command.config || !command.config.name) {
      return { success: false, message: `❌ File is not a valid command` };
    }

    const dir = path.dirname(filePath);
    registerCommand(command, filePath, dir);

    const category = path.relative(COMMANDS_DIR, dir).replace(/\\/g, '/') || 'root';
    const prefix = category !== 'root' ? `[${category}]` : '';

    return {
      success: true,
      message: `✅ Reloaded command: ${prefix} ${command.config.name}`
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Error loading: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

export const loadMultipleCommands = (commandNames: string[]): { success: boolean; message: string; loaded: number; failed: number } => {
  let loaded = 0;
  let failed = 0;
  const failedCommands: string[] = [];

  for (const commandName of commandNames) {
    const result = loadSingleCommand(commandName);
    if (result.success) {
      loaded++;
    } else {
      failed++;
      failedCommands.push(commandName);
    }
  }

  let message = `✅ Loaded ${loaded} commands`;
  if (failed > 0) {
    message += `\n❌ Failed ${failed} commands: ${failedCommands.join(', ')}`;
  }

  return {
    success: loaded > 0,
    message,
    loaded,
    failed
  };
};

export const unloadCommand = (commandName: string): { success: boolean; message: string } => {
  const command = client.commands.get(commandName) || client.noprefix.get(commandName);

  if (!command) {
    return { success: false, message: `❌ Command not found: "${commandName}"` };
  }

  client.commands.delete(commandName);
  client.noprefix.delete(commandName);

  if (command.config?.aliases) {
    command.config.aliases.forEach(alias => {
      client.commands.delete(alias.toLowerCase());
      client.noprefix.delete(alias.toLowerCase());
    });
  }

  let removedReplies = 0;
  let removedReactions = 0;

  for (const [messageID, context] of client.handleReplies.entries()) {
    if (context.name === commandName) {
      client.handleReplies.delete(messageID);
      removedReplies++;
    }
  }

  for (const [messageID, context] of client.handleReactions.entries()) {
    if (context.name === commandName) {
      client.handleReactions.delete(messageID);
      removedReactions++;
    }
  }

  let extraInfo = '';
  if (removedReplies > 0 || removedReactions > 0) {
    extraInfo = ` (removed ${removedReplies} handleReply, ${removedReactions} handleReaction)`;
  }

  return {
    success: true,
    message: `✅ Unloaded command "${commandName}"${command.config?.aliases ? ` and ${command.config.aliases.length} aliases` : ''}${extraInfo}`
  };
};

export const loadCommands = (dir: string = COMMANDS_DIR): void => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return;
  }

  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      loadCommands(fullPath);
    } else if (item.isFile() && (item.name.endsWith('.ts') || item.name.endsWith('.js'))) {
      try {
        delete require.cache[require.resolve(fullPath)];

        const command: ICommand = require(fullPath);

        if (command.config && command.config.name) {
          registerCommand(command, fullPath, dir);
        }
      } catch (error) {
        logger.error(`Error loading file ${fullPath}:`, error);
      }
    }
  }

  if (dir === COMMANDS_DIR) {
    logger.info(`Summary: ${client.commands.size} prefix commands, ${client.noprefix.size} no-prefix commands`);
  }
};
