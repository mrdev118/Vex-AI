import { ICommand, IRunParams } from '../../types';

const command: ICommand = {
    config: {
        name: "kick",
        version: "1.0.0",
        author: "Donix",
        description: "Kick user from group",
        category: "Admin",
        usages: "!kick @user or !kick <userID>",
        role: 1 // Group Admin
    },

    run: async ({ api, event, args, send }: IRunParams) => {

        if (!event.isGroup) {
            await send("This command can only be used in groups!");
            return;
        }

        const eventWithReply = event as any;
        
        if (args.length === 0 && !eventWithReply.messageReply) {
            await send("Please tag the user to kick, reply to their message, or enter their userID!");
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
            await send("❌ Unable to identify the user to kick. Please tag them, reply to their message, or provide their userID.");
            return;
        }

        // Don't allow kicking yourself or the bot
        if (targetID === event.senderID) {
            await send("❌ You cannot kick yourself!");
            return;
        }

        if (targetID === api.getCurrentUserID()) {
            await send("❌ I cannot kick myself!");
            return;
        }

        try {
            api.removeUserFromGroup(targetID, event.threadID, async (err?: Error) => {
                if (err) {
                    await send(`❌ Error kicking: ${err.message}`);
                } else {
                    // Get user info for better message
                    api.getUserInfo(targetID, async (infoErr, userInfo) => {
                        const userName = userInfo && userInfo[targetID] ? userInfo[targetID].name : targetID;
                        await send(`👢 Kicked ${userName} (${targetID}) from the group!`);
                    });
                }
            });
        } catch (error: any) {
            await send(`❌ An error occurred while kicking user: ${error.message || error}`);
        }
    }
};

export = command;
