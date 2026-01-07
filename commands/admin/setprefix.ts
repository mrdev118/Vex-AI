import { ICommand, IRunParams } from '../../types';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../src/utils/logger';

const CONFIG_PATH = path.resolve(__dirname, '../../config.json');

const command: ICommand = {
    config: {
        name: "setprefix",
        version: "1.0.0",
        author: "VexAI",
        description: "Change the bot's command prefix (Owner only)",
        category: "Admin",
        usages: "!setprefix <new_prefix>",
        role: 3 // Owner only
    },

    run: async ({ api, event, args, send }: IRunParams) => {

        if (args.length === 0) {
            await send("❌ Please provide a new prefix!\nUsage: setprefix <new_prefix>\nExample: setprefix .");
            return;
        }

        const newPrefix = args[0];

        // Validate prefix
        if (newPrefix.length > 5) {
            await send("❌ Prefix is too long! Maximum length is 5 characters.");
            return;
        }

        if (newPrefix.includes(' ')) {
            await send("❌ Prefix cannot contain spaces!");
            return;
        }

        try {
            // Read current config
            const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
            const config = JSON.parse(configData);
            
            const oldPrefix = config.bot.prefix;

            // Update prefix
            config.bot.prefix = newPrefix;

            // Save to file with formatting
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');

            logger.info(`Prefix changed from "${oldPrefix}" to "${newPrefix}" by ${event.senderID}`);
            await send(
                `✅ Prefix successfully changed!\n` +
                `Old prefix: ${oldPrefix}\n` +
                `New prefix: ${newPrefix}\n\n` +
                `⚠️ Please restart the bot for changes to take effect.`
            );

        } catch (error: any) {
            logger.error('Error changing prefix:', error);
            await send(`❌ Failed to change prefix: ${error.message || error}`);
        }
    }
};

export = command;
