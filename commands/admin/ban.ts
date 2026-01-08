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

        const eventWithReply = event as any;
        
        if (args.length === 0 && !eventWithReply.messageReply) {
            await send("Please tag the user to ban, reply to their message, or enter their userID!");
            return;
        }

        let targetID: string = "";

        // Check if replying to a message
        if (eventWithReply.messageReply) {
            targetID = eventWithReply.messageReply.senderID;
        }
        // Check for mentions
        else if (event.mentions && Object.keys(event.mentions).length > 0) {
            targetID = Object.keys(event.mentions)[0];
        }
        // Check args for userID
        else if (args[0]) {
            targetID = args[0].replace('@', '').trim();
        }

        if (!targetID || targetID === '') {
            await send("❌ Unable to identify the user to ban. Please tag them, reply to their message, or provide their userID.");
            return;
        }

        // Don't allow banning yourself or the bot
        if (targetID === event.senderID) {
            await send("❌ You cannot ban yourself!");
            return;
        }

        if (targetID === api.getCurrentUserID()) {
            await send("❌ I cannot ban myself!");
            return;
        }

        try {
            // Safely parse existing banned list
            const threadData = await Threads.getData(event.threadID);
            let bannedList: string[] = [];
            try {
                const parsed = JSON.parse(threadData.bannedUsers || "[]");
                bannedList = Array.isArray(parsed) ? parsed.map((id: any) => String(id)) : [];
            } catch {
                bannedList = [];
            }

            if (bannedList.includes(targetID)) {
                await send(`⚠️ User ${targetID} is already banned from this group!`);
                return;
            }

            // Attempt to remove the user first; only persist ban on success
            const removalError = await new Promise<Error | null>((resolve) => {
                api.removeUserFromGroup(targetID, event.threadID, (err?: Error) => {
                    resolve(err || null);
                });
            });

            if (removalError) {
                const message = (removalError as any).message || String(removalError);
                await send(`❌ Error removing user: ${message}\n(No changes were made to the ban list)`);
                return;
            }

            bannedList.push(targetID);
            threadData.bannedUsers = JSON.stringify(bannedList);
            await threadData.save();

            const userName = await new Promise<string>((resolve) => {
                api.getUserInfo(targetID, (_infoErr, userInfo) => {
                    const name = userInfo && userInfo[targetID] ? userInfo[targetID].name : targetID;
                    resolve(name);
                });
            });

            await send(`✅ Successfully banned ${userName} (${targetID}) from the group permanently!`);
        } catch (error: any) {
            await send(`❌ An error occurred while banning user: ${error.message || error}`);
        }
    }
};

export = command;
