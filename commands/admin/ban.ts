import { ICommand, IRunParams } from '../../types';

const command: ICommand = {
    config: {
        name: "ban",
        version: "1.0.0",
        author: "Donix",
        description: "Ban user from group",
        category: "Admin",
        usages: "!ban @user or !ban <userID>",
        role: 1 // Group Admin
    },

    run: async ({ api, event, args, send }: IRunParams) => {

        if (!event.isGroup) {
            await send("This command can only be used in groups!");
            return;
        }

        if (args.length === 0) {
            await send("Please tag the user to ban or enter userID!");
            return;
        }

        let targetID = args[0];

        if (targetID.startsWith('@')) {
            const mentions = (event as any).mentions || {};
            targetID = Object.keys(mentions)[0] || targetID.replace('@', '');
        }

        try {
            api.removeUserFromGroup(targetID, event.threadID, async (err?: Error) => {
                if (err) {
                    await send(`❌ Error banning: ${err.message}`);
                } else {
                    await send(`✅ Banned user ${targetID} from the group!`);
                }
            });
        } catch (error) {
            await send("❌ An error occurred while banning user!");
        }
    }
};

export = command;
