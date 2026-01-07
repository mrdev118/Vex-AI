import { ICommand, IRunParams } from '../../types';
import { Threads } from '../../database/controllers/threadController';

const command: ICommand = {
    config: {
        name: "unban",
        version: "1.0.1",
        author: "Donix",
        description: "Unban user and allow them back to group",
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
            // Update banned list in DB
            const threadData = await Threads.getData(event.threadID);
            let bannedList: string[] = [];
            try {
                bannedList = JSON.parse(threadData.bannedUsers || "[]");
            } catch (e) {
                bannedList = [];
            }

            if (bannedList.includes(userID)) {
                bannedList = bannedList.filter(id => id !== userID);
                threadData.bannedUsers = JSON.stringify(bannedList);
                await threadData.save();
                
                await send(`✅ User ${userID} has been unbanned. They can now join the group.`);
            } else {
                await send(`ℹ️ User ${userID} is not in the ban list of this group.`);
            }
        } catch (error) {
            await send("❌ An error occurred while unbanning user!");
        }
    }
};

export = command;
