import { ICommand, IRunParams, IHandleParams, IFCAU_User } from '../../types';
import { client } from '../../src/client';
import { Threads } from '../../database/controllers/threadController';

const fakeReasons = [
    "Immature behavior disrupting group activities",
    "Coordinated raid attempt on server",
    "Trolling and intentional provocation of members",
    "Repeated disruption of group conversations",
    "Childish conduct unbecoming of group standards",
    "Intentional sabotage of group discussions",
    "Malicious trolling targeting group members",
    "Organized disruption and server raiding",
    "Persistent immature behavior despite warnings",
    "Deliberate instigation of conflict among members"
];

const prankWarnings = [
    "Your personal information has been forwarded to server administrators across 47 connected groups.",
    "All group admins in the network have been notified about your violations.",
    "Your data has been logged and shared with partnered community moderators.",
    "A report has been filed and distributed to 100+ server administrators.",
    "Your account details are now visible to all network moderators for review."
];

const command: ICommand = {
    config: {
        name: "report",
        hasPrefix: true,
        description: "Prank report command - fake reports a user (Admin only)",
        category: "Entertainment",
        aliases: ["fakereport", "prankreport"],
        usages: "[mention/reply/userID]",
        cooldown: 10,
        role: 1 // Admin only
    },

    run: async ({ api, event, args, send, reply }: IRunParams) => {
        let targetId: string | null = null;
        let targetName: string = "Unknown User";

        // Check if replying to a message
        if (event.type === "message_reply" && event.messageReply) {
            targetId = event.messageReply.senderID;
        }
        // Check for mentions
        else if (event.mentions && Object.keys(event.mentions).length > 0) {
            targetId = Object.keys(event.mentions)[0];
            targetName = event.mentions[targetId].replace(/@/g, '').trim();
        }
        // Check if user provided an ID as argument
        else if (args[0] && /^\d+$/.test(args[0])) {
            targetId = args[0];
        }

        if (!targetId) {
            return reply("Please mention a user, reply to their message, or provide their ID.\n\nUsage: .report @user / .report [userID] / reply to a message");
        }

        // Step 1: Initial reporting message
        await send(`Reporting account...\nPlease wait...`);

        // Fake delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 2: Fetching user data
        await send(`Fetching user data from Facebook servers...\nExtracting metadata...`);

        // Get detailed user info from Facebook
        let userInfo: IFCAU_User | null = null;
        try {
            const info = await api.getUserInfo([targetId]);
            if (info && info[targetId]) {
                userInfo = info[targetId];
                targetName = userInfo.name || targetName;
            }
        } catch {
            // Continue with limited info
        }

        // Another delay
        await new Promise(resolve => setTimeout(resolve, 2500));

        await send(`Target found: ${targetName}\nAnalyzing account activity...`);

        // Final delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Generate weird nonsense numbers
        const nonsenseCode1 = `0x${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
        const nonsenseCode2 = `${Math.floor(Math.random() * 9999999999)}/${Math.floor(Math.random() * 999999)}`;
        const nonsenseCode3 = `REF-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Math.floor(Math.random() * 9999)}`;
        const nonsenseCode4 = `[${Array.from({ length: 4 }, () => Math.floor(Math.random() * 256)).join('.')}]`;
        const nonsenseCode5 = `#${Math.floor(Math.random() * 99999999).toString().padStart(8, '0')}`;
        
        const randomReason = fakeReasons[Math.floor(Math.random() * fakeReasons.length)];
        const randomWarning = prankWarnings[Math.floor(Math.random() * prankWarnings.length)];

        // Build user info section with real data where available
        const gender = userInfo?.gender === 1 ? "Female" : userInfo?.gender === 2 ? "Male" : "Not specified";
        const isFriend = userInfo?.isFriend ? "Yes" : "No";
        const vanity = userInfo?.vanity || targetName.toLowerCase().replace(/\s+/g, '.');
        
        const collectedInfo = [
            `Full Name: ${targetName}`,
            `Facebook ID: ${targetId}`,
            `Profile URL: facebook.com/${vanity}`,
            `Gender: ${gender}`,
            `Is Friend: ${isFriend}`,
            `Location: Southeast Asia`,
            `Account Status: Active`,
            `Risk Level: HIGH`,
            `Trace Code: ${nonsenseCode1}`,
            `Data Hash: ${nonsenseCode2}`,
            `Reference: ${nonsenseCode3}`,
            `Node: ${nonsenseCode4}`,
            `Case ID: ${nonsenseCode5}`
        ];

        const reportMessage = 
            `REPORT SUCCESSFUL\n\n` +
            `Account "${targetName}" has been SUCCESSFULLY REPORTED to Facebook and connected server networks.\n\n` +
            `REPORT DETAILS\n` +
            `Reason: ${randomReason}\n` +
            `Report Time: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}\n` +
            `Severity: CRITICAL\n\n` +
            `COLLECTED INFORMATION\n` +
            collectedInfo.join('\n') + '\n\n' +
            `WARNING TO USER\n` +
            `${randomWarning}\n\n` +
            `Your violations have been recorded and your personal data has been extracted and distributed to trusted moderators for review.\n\n` +
            `Continued violations may result in:\n` +
            `- Permanent account suspension\n` +
            `- IP address blacklisting\n` +
            `- Report to cybercrime authorities\n\n` +
            `Vex AI Automated Security System\n` +
            `Report ID: #${Date.now().toString(36).toUpperCase()}`;

        await send(reportMessage);

        // Ask for action
        const actionMessage = 
            `\nADMIN ACTION REQUIRED\n\n` +
            `Would you like to take action against ${targetName}?\n\n` +
            `Reply with:\n` +
            `1 - Ban ${targetName} permanently\n` +
            `2 - Kick ${targetName} from group\n` +
            `cancel - Cancel action\n\n` +
            `You have 60 seconds to respond.`;

        api.sendMessage(actionMessage, event.threadID, (err, info) => {
            if (err || !info) return;

            client.handleReplies.set(info.messageID, {
                messageID: info.messageID,
                name: "report",
                author: event.senderID,
                targetId: targetId,
                targetName: targetName,
                threadID: event.threadID
            });

            // Auto-delete after 60 seconds
            setTimeout(() => {
                client.handleReplies.delete(info.messageID);
            }, 60000);
        });
    },

    handleReply: async ({ api, event, send, handleReply }: IHandleParams) => {
        if (!handleReply) return;

        // Only the original author can respond
        if (event.senderID !== handleReply.author) {
            return send("Only the admin who initiated the report can take action.");
        }

        const choice = (event as any).body?.trim();
        const targetId = handleReply.targetId as string;
        const targetName = handleReply.targetName as string;
        const threadID = event.threadID;

        // Remove the handleReply entry
        if (handleReply.messageID) {
            client.handleReplies.delete(handleReply.messageID);
        }

        if (choice === "1") {
            // Ban the user
            try {
                // Get thread data for ban list
                const threadData = await Threads.getData(threadID);
                let bannedList: string[] = [];
                try {
                    const parsed = JSON.parse(threadData.bannedUsers || "[]");
                    bannedList = Array.isArray(parsed) ? parsed.map((id: any) => String(id)) : [];
                } catch {
                    bannedList = [];
                }

                if (bannedList.includes(targetId)) {
                    await send(`${targetName} is already banned from this group.`);
                    return;
                }

                // Remove user from group
                const removalError = await new Promise<Error | null>((resolve) => {
                    api.removeUserFromGroup(targetId, threadID, (err?: Error) => {
                        resolve(err || null);
                    });
                });

                if (removalError) {
                    await send(`Failed to remove ${targetName}: ${removalError.message}`);
                    return;
                }

                // Add to ban list
                bannedList.push(targetId);
                threadData.bannedUsers = JSON.stringify(bannedList);
                await threadData.save();

                await send(
                    `BAN EXECUTED\n\n` +
                    `${targetName} has been PERMANENTLY BANNED.\n\n` +
                    `Their violations have been logged and they will not be able to rejoin this group.\n\n` +
                    `Vex AI Security System`
                );
            } catch (error: any) {
                await send(`Error banning user: ${error.message || error}`);
            }
        } else if (choice === "2") {
            // Kick the user
            try {
                api.removeUserFromGroup(targetId, threadID, async (err?: Error) => {
                    if (err) {
                        await send(`Failed to kick ${targetName}: ${err.message}`);
                    } else {
                        await send(
                            `KICK EXECUTED\n\n` +
                            `${targetName} has been KICKED from the group.\n\n` +
                            `They may rejoin if invited, but their violations have been recorded.\n\n` +
                            `Vex AI Security System`
                        );
                    }
                });
            } catch (error: any) {
                await send(`Error kicking user: ${error.message || error}`);
            }
        } else {
            await send(`Action cancelled. No action was taken against ${targetName}.`);
        }
    }
};

export = command;
