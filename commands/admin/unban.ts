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

        const eventWithReply = event as any;

        // Accept reply, mention, or raw ID
        let userID = "";
        if (eventWithReply.messageReply) {
            userID = eventWithReply.messageReply.senderID;
        } else if (event.mentions && Object.keys(event.mentions).length > 0) {
            userID = Object.keys(event.mentions)[0];
        } else if (args[0]) {
            userID = args[0];
        }

        userID = userID.replace('@', '').trim();

        if (!userID) {
            await send("Please tag the user, reply to their message, or enter the userID to unban!");
            return;
        }

        try {
            // Update banned list in DB
            const threadData = await Threads.getData(event.threadID);
            let bannedList: string[] = [];
            try {
                const parsed = JSON.parse(threadData.bannedUsers || "[]");
                bannedList = Array.isArray(parsed) ? parsed.map((id: any) => String(id)) : [];
            } catch {
                bannedList = [];
            }

            if (bannedList.includes(userID)) {
                bannedList = bannedList.filter(id => String(id) !== userID);
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
