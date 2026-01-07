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
            // Update banned list in DB first
            const threadData = await Threads.getData(event.threadID);
            let bannedList: string[] = [];
            try {
                bannedList = JSON.parse(threadData.bannedUsers || "[]");
            } catch (e) {
                bannedList = [];
            }

            if (bannedList.includes(targetID)) {
                await send(`⚠️ User ${targetID} is already banned from this group!`);
                return;
            }

            bannedList.push(targetID);
            threadData.bannedUsers = JSON.stringify(bannedList);
            await threadData.save();

            // Now remove the user from group
            api.removeUserFromGroup(targetID, event.threadID, async (err?: Error) => {
                if (err) {
                    await send(`❌ Error removing user: ${err.message}\n(User is still added to ban list)`);
                } else {
                    // Get user info for better message
                    api.getUserInfo(targetID, async (infoErr, userInfo) => {
                        const userName = userInfo && userInfo[targetID] ? userInfo[targetID].name : targetID;
                        await send(`✅ Successfully banned ${userName} (${targetID}) from the group permanently!`);
                    });
                }
            });
        } catch (error: any) {
            await send(`❌ An error occurred while banning user: ${error.message || error}`);
        }
    }
};

export = command;
