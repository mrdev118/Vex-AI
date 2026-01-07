import { ICommand, IRunParams } from '../../types';

const command: ICommand = {
    config: {
        name: "unban",
        version: "1.0.0",
        author: "Donix",
        description: "Unban user (add back to group)",
        category: "Admin",
        usages: "!unban <userID>",
        role: 1 // Group Admin
    },

    run: async ({ api, event, args, send }: IRunParams) => {

        if (!event.isGroup) {
            await send("This command can only be used in groups!");
            return;
        }

        if (args.length === 0) {
            await send("Please enter the userID to unban!");
            return;
        }

        const userID = args[0];

        try {
            api.addUserToGroup(userID, event.threadID, async (err?: Error) => {
                if (err) {
                    await send(`❌ Error unbanning (adding): ${err.message}`);
                } else {
                    await send(`✅ Unbanned (added) user ${userID} back to the group!`);
                }
            });
        } catch (error) {
            await send("❌ An error occurred while unbanning user!");
        }
    }
};

export = command;
