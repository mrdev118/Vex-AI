import { ICommand, IRunParams } from '../../types';
import { client } from '../../src/client';
import { PREFIX, isOwner, isAdmin } from '../../src/config';
import { hasPermission } from '../../src/utils/permissions';

const categoryEmojis: { [key: string]: string } = {
    'Admin': '🛡️',
    'AI': '🤖',
    'Entertainment': '🎮',
    'Utility': '🔧',
    'System': '⚙️',
    'Media': '📱',
    'General': '📦'
};

const command: ICommand = {
    config: {
        name: "help",
        version: "2.0.0",
        author: "Donix",
        description: "View organized command list",
        category: "System",
        usages: ".help or .help <command>"
    },

    run: async ({ api, event, args }: IRunParams) => {
        const commandName = args[0]?.toLowerCase();
        const hasAdminAccess = await hasPermission(api, event.senderID, event, 1);

        const dedupedCommands = new Map<string, ICommand>();
        for (const [, cmd] of client.commands.entries()) {
          const baseName = cmd.config.name.toLowerCase();
          if (!dedupedCommands.has(baseName)) {
            dedupedCommands.set(baseName, cmd);
          }
        }

        if (commandName) {
            const cmd = client.commands.get(commandName);
            if (cmd) {
                const isAdminCommand = (cmd.config.category || '').toLowerCase() === 'admin' || (cmd.config.role ?? 0) > 0;
                if (isAdminCommand && !hasAdminAccess) {
                    api.sendMessage(`❌ Command not available: "${commandName}"`, event.threadID);
                    return;
                }

                const categoryEmoji = categoryEmojis[cmd.config.category || 'General'] || '📦';
                const aliases = cmd.config.aliases ? `\n🔄 ${cmd.config.aliases.join(', ')}` : '';
                const usage = cmd.config.usages ? `\n📖 ${cmd.config.usages}` : '';
                const role = cmd.config.role !== undefined ? `\n🔐 ${['User', 'Group Admin', 'Bot Admin', 'Owner'][cmd.config.role]}` : '';
                
                const info = `━━━ 📋 COMMAND INFO ━━━

📌 ${PREFIX}${cmd.config.name}
${categoryEmoji} ${cmd.config.category || 'General'}
📝 ${cmd.config.description || 'No description'}${usage}${aliases}${role}
👤 ${cmd.config.author || 'Unknown'}`;
                
                api.sendMessage(info, event.threadID);
            } else {
                api.sendMessage(`❌ Command not found: "${commandName}"\n💡 Use ${PREFIX}help to see all commands`, event.threadID);
            }
            return;
        }

        const helpful: string[] = [];
        const serverCommands: string[] = [];
        const adminCommands: string[] = [];

        dedupedCommands.forEach((cmd) => {
            const nameLabel = `${PREFIX}${cmd.config.name}`;
            const lowerCategory = (cmd.config.category || '').toLowerCase();
            const requiresAdmin = lowerCategory === 'admin' || (cmd.config.role ?? 0) > 0;

            if (cmd.config.name.toLowerCase() === 'server') {
                serverCommands.push(nameLabel);
                return;
            }

            if (requiresAdmin) {
                adminCommands.push(nameLabel);
                return;
            }

            helpful.push(nameLabel);
        });

        const formatLines = (items: string[]): string => {
            if (items.length === 0) return 'None';
            const sorted = [...items].sort((a, b) => a.localeCompare(b));
                return sorted.map(item => `- ${item}`).join('\n');
        };

        let totalVisible = helpful.length + serverCommands.length;
        if (hasAdminAccess) {
            totalVisible += adminCommands.length;
        }

            let message = `🤖 VEX AI HELP\n⚡ Prefix: ${PREFIX}\n📊 Commands: ${totalVisible}\n`;

        message += `\n🔧 HELPFUL COMMANDS\n${formatLines(helpful)}`;
        message += `\n🛰️ SERVER COMMAND\n${formatLines(serverCommands)}`;

        if (hasAdminAccess && adminCommands.length > 0) {
            message += `\n🛡️ ADMIN COMMANDS\n${formatLines(adminCommands)}`;
        }

            message += `\n💡 ${PREFIX}help <cmd> for info`;

        api.sendMessage(message, event.threadID);
    }
};

export = command;
