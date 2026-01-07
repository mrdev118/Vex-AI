import { ICommand, IRunParams } from '../../types';
import { client } from '../../src/client';
import { PREFIX } from '../../src/config';

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

        if (commandName) {
            const cmd = client.commands.get(commandName);
            if (cmd) {
                const categoryEmoji = categoryEmojis[cmd.config.category || 'General'] || '📦';
                const aliases = cmd.config.aliases ? `\n🔄 ${cmd.config.aliases.join(', ')}` : '';
                const usage = cmd.config.usages ? `\n📖 ${cmd.config.usages}` : '';
                const role = cmd.config.role !== undefined ? `\n🔐 ${['User', 'Admin', 'Bot Admin', 'Owner'][cmd.config.role]}` : '';
                
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

        const categories = new Map<string, Array<{ name: string; desc: string }>>();

        for (const [name, cmd] of client.commands.entries()) {
            const category = cmd.config.category || 'General';
            if (!categories.has(category)) {
                categories.set(category, []);
            }
            categories.get(category)!.push({
                name: name,
                desc: cmd.config.description || 'No description'
            });
        }

        // Sort categories by priority
        const categoryOrder = ['System', 'Admin', 'AI', 'Entertainment', 'Utility', 'Media', 'General'];
        const sortedCategories = Array.from(categories.entries()).sort((a, b) => {
            const indexA = categoryOrder.indexOf(a[0]);
            const indexB = categoryOrder.indexOf(b[0]);
            return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
        });

        let message = `━━━━ 🤖 VEX AI ━━━━
⚡ Prefix: ${PREFIX}
📊 Commands: ${client.commands.size}

`;

        for (const [category, commands] of sortedCategories) {
            const emoji = categoryEmojis[category] || '📦';
            message += `\n${emoji} ${category.toUpperCase()}\n`;
            
            // Sort commands alphabetically
            commands.sort((a, b) => a.name.localeCompare(b.name));
            
            // Display commands in compact format (3 per line on mobile)
            const cmdNames = commands.map(cmd => PREFIX + cmd.name);
            for (let i = 0; i < cmdNames.length; i += 3) {
                const line = cmdNames.slice(i, i + 3).join(' | ');
                message += `${line}\n`;
            }
        }

        message += `\n💡 ${PREFIX}help <cmd> for info
━━━━━━━━━━━━━━━━━`;

        api.sendMessage(message, event.threadID);
    }
};

export = command;
