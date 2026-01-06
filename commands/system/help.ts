import { ICommand, IRunParams } from '../../types';
import { client } from '../../src/client';
import { PREFIX } from '../../src/config';

const command: ICommand = {
    config: {
        name: "help",
        version: "1.0.0",
        author: "Donix",
        description: "View command list",
        category: "System"
    },

    run: async ({ api, event, args }: IRunParams) => {
        const commandName = args[0]?.toLowerCase();

        if (commandName) {
            const cmd = client.commands.get(commandName);
            if (cmd) {
                const info = `
📋 Command Info: ${PREFIX}${cmd.config.name}

📝 Description: ${cmd.config.description || 'No description'}
👤 Author: ${cmd.config.author || 'Unknown'}
📦 Version: ${cmd.config.version || '1.0.0'}
📁 Category: ${cmd.config.category || 'General'}
                `.trim();
                api.sendMessage(info, event.threadID);
            } else {
                api.sendMessage(`❓ Command not found "${commandName}"`, event.threadID);
            }
            return;
        }

        const categories = new Map<string, string[]>();

        for (const [name, cmd] of client.commands.entries()) {
            const category = cmd.config.category || 'General';
            if (!categories.has(category)) {
                categories.set(category, []);
            }
            categories.get(category)!.push(name);
        }

        let message = `📚 Command List (Prefix: ${PREFIX})\n\n`;

        for (const [category, commands] of categories.entries()) {
            message += `📁 ${category}:\n`;
            message += commands.map(cmd => `  • ${PREFIX}${cmd}`).join('\n');
            message += '\n\n';
        }

        message += `💡 Use ${PREFIX}help <command name> for details`;

        api.sendMessage(message, event.threadID);
    }
};

export = command;
