import { ICommand, IHandleParams, IRunParams } from '../../types';
import { client } from '../../src/client';

const command: ICommand = {
  config: {
    name: "announce",
    hasPrefix: true,
    description: "Send announcement to selected group chats",
    category: "Admin",
    role: 2,
    usages: "announce <message>"
  },

  run: async ({ api, event, args, send }: IRunParams): Promise<void> => {
    const { threadID, senderID, messageID } = event;

    if (args.length === 0) {
      send("⚠️ Please provide an announcement message!\n\nUsage: .announce <message>");
      return;
    }

    const announcementText = args.join(' ');

    try {
      // Get all thread list
      api.getThreadList(100, null, ["INBOX"], (err, threads) => {
        if (err || !threads) {
          send("❌ Failed to get group chat list!");
          return;
        }

        // Filter only group chats
        const groupChats = threads
          .filter((thread: any) => thread.isGroup)
          .filter((thread: any) => thread.isSubscribed !== false && !thread.isArchived);

        if (groupChats.length === 0) {
          send("❌ No group chats found!");
          return;
        }

        let message = `𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 𝗔𝗻𝗻𝗼𝘂𝗻𝗰𝗲𝗺𝗲𝗻𝘁 𝗦𝘆𝘀𝘁𝗲𝗺\n\n`;
        message += `📢 Select a group to announce:\n\n`;

        groupChats.forEach((thread: any, index: number) => {
          const threadName = thread.name || `Unnamed Group`;
          message += `${index + 1}. ${threadName}\n`;
        });

        message += `\n💬 Reply with the number to send announcement`;

        api.sendMessage(message, threadID, (err, info) => {
          if (err || !info) return;

          client.handleReplies.set(info.messageID, {
            name: command.config.name,
            messageID: info.messageID,
            author: senderID,
            announcementText,
            groupChats: groupChats.map((thread: any) => ({
              threadID: thread.threadID,
              name: thread.name || 'Unnamed Group'
            }))
          });
        });
      });
    } catch (error) {
      send("❌ An error occurred while fetching group chats!");
    }
  },

  handleReply: async ({ api, event, handleReply }: IHandleParams): Promise<void> => {
    const { threadID, senderID, body } = event;

    if (senderID !== handleReply?.author) {
      return;
    }

    const selection = parseInt(body.trim());
    const groupChats = handleReply.groupChats as Array<{ threadID: string; name: string }>;
    const announcementText = handleReply.announcementText as string;

    if (isNaN(selection) || selection < 1 || selection > groupChats.length) {
      api.sendMessage(`⚠️ Invalid selection! Please choose a number between 1 and ${groupChats.length}`, threadID);
      return;
    }

    const selectedGroup = groupChats[selection - 1];
    const announcementMessage = `𝗔𝗡𝗡𝗢𝗨𝗡𝗖𝗘𝗠𝗘𝗡𝗧\n- from 𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 Staffs\n\n${announcementText}`;

    try {
      api.sendMessage(announcementMessage, selectedGroup.threadID, (err) => {
        if (err) {
          api.sendMessage(`❌ Failed to send announcement to ${selectedGroup.name}!`, threadID);
        } else {
          api.sendMessage(`✅ Announcement sent successfully to: ${selectedGroup.name}`, threadID);
        }
      });
    } catch (error) {
      api.sendMessage("❌ An error occurred while sending announcement!", threadID);
    }

    // Clean up handleReply
    client.handleReplies.delete(handleReply.messageID);
  }
};

export = command;
