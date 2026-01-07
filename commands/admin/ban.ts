import { ICommand, IRunParams } from '../../types';
import { Threads } from '../../database/controllers/threadController';
import Thread from '../../database/models/Thread';

const command: ICommand = {
    config: {
        name: "ban",
        version: "1.0.1",
        author: "Donix",
        description: "Ban user from group permanently",
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
            // Update banned list in DB
            const threadData = await Threads.getData(event.threadID);
            let bannedList: string[] = [];
            try {
                bannedList = JSON.parse(threadData.bannedUsers || "[]");
            } catch (e) {
                bannedList = [];
            }

            if (!bannedList.includes(targetID)) {
                bannedList.push(targetID);
                threadData.bannedUsers = JSON.stringify(bannedList);
                await threadData.save();
            }

            api.removeUserFromGroup(targetID, event.threadID, async (err?: Error) => {
                if (err) {
                    await send(`❌ Error banning: ${err.message}`);
                } else {
                    await send(`✅ Banned user ${targetID} from the group permanently!`);
                }
            });
        } catch (error) {
            await send("❌ An error occurred while banning user!");
        }
    }
};

export = command;
