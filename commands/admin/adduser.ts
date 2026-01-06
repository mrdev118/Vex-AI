import { ICommand, IRunParams } from '../../types';

const command: ICommand = {
    config: {
        name: "adduser",
        version: "1.0.0",
        author: "Donix",
        description: "Add user to group",
        category: "Admin",
        usages: "!adduser <userID>",
        role: 1 // Group Admin
    },

    run: async ({ api, event, args, send }: IRunParams) => {

        if (!event.isGroup) {
            await send("This command can only be used in groups!");
            return;
        }

        if (args.length === 0) {
            await send("Please enter userID to add!");
            return;
        }

        const userID = args[0];

        try {
            api.addUserToGroup(userID, event.threadID, async (err?: Error) => {
                if (err) {
                    await send(`❌ Error adding: ${err.message}`);
                } else {
                    await send(`✅ Added user ${userID} to the group!`);
                }
            });
        } catch (error) {
            await send("❌ An error occurred while adding user!");
        }
    }
};

export = command;
