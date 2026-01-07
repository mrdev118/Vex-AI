import type { IFCAU_API } from '@dongdev/fca-unofficial';
import { ICommand, ThreadEventType } from '../../types';
import { client } from '../client';
import { logger } from '../utils/logger';
import { Users } from '../../database/controllers/userController';
import { Threads } from '../../database/controllers/threadController';

export const handleEvent = async (
  api: IFCAU_API,
  event: ThreadEventType
): Promise<void> => {
  const processedCommands = new Set<ICommand>();
  for (const command of [...client.commands.values(), ...client.noprefix.values()]) {
    if (command.handleEvent && !processedCommands.has(command)) {
      processedCommands.add(command);
      try {
        await command.handleEvent({
          api,
          event,
          config: command.config,
          Users,
          Threads
        });
      } catch (error) {
        logger.error(`Error handleEvent in command ${command.config.name}:`, error);
      }
    }
  }

  // Auto-kick logic for banned users
  if (event.type === "event" && event.logMessageType === 'log:subscribe') {
    const threadID = event.threadID;
    const addedParticipants = (event as any).logMessageData?.addedParticipants || [];
    
    try {
      // Check if bot was just added to the group
      const botAdded = addedParticipants.some((p: any) => p.userFbId === api.getCurrentUserID());
      
      if (botAdded) {
        // Set bot nickname
        api.changeNickname("🤖 VEXON BOT", threadID, api.getCurrentUserID(), (err) => {
          if (!err) {
            logger.info(`Bot nickname set to 🤖 VEXON BOT in group ${threadID}`);
          }
        });
        
        // Send bot connected message with image
        const connectedMessage = {
          body: `✅ 🤖 Bot Connected!\n\nHello! I'm VEXON BOT. I'm here to help manage your group with amazing commands and features.\n\nUse "help" to see all available commands!\n\nServer IP: vexonsmp.sereinhost.com:25581`,
          attachment: require('fs').createReadStream(__dirname + '/../../attached_assets/stock_images/futuristic_bot_logo__28f312bd.jpg')
        };
        api.sendMessage(connectedMessage, threadID);
      }
      
      const threadData = await Threads.getData(threadID);
      let bannedList: string[] = [];
      try {
        bannedList = JSON.parse(threadData.bannedUsers || "[]");
      } catch (e) {
        bannedList = [];
      }

      if (bannedList.length > 0) {
        for (const participant of addedParticipants) {
          const userFbId = participant.userFbId;
          if (bannedList.includes(userFbId)) {
            api.removeUserFromGroup(userFbId, threadID, (err) => {
              if (!err) {
                api.sendMessage(`🚫 Auto-kick: User ${participant.fullName} (${userFbId}) is permanently banned from this group.`, threadID);
                logger.info(`Auto-kicked banned user ${userFbId} from group ${threadID}`);
              }
            });
            continue;
          }
          // Welcome message for non-banned users (skip if bot was just added)
          if (!botAdded) {
            const welcomeMessage = {
              body: `𝗪𝗲𝗹𝗰𝗼𝗺𝗲 to 𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 ${participant.fullName}\n𝗦𝗲𝗿𝘃𝗲𝗿to follow all the rules, you can see all the rules on our 𝗗𝗶𝘀𝗰𝗼𝗿𝗱 server\nhttps://discord.gg/WXpMxBEYYA\n\n𝗦𝗘𝗥𝗩𝗘𝗥 𝗜𝗡𝗙𝗢:\n𝗡𝗮𝗺𝗲: VexonSMP\n𝗜𝗣: vexonsmp.sereinhost.com\n𝗣𝗼𝗿𝘁: 25581\n\n• Feel free to invite your friends here on our server for more fun`,
              attachment: require('fs').createReadStream(__dirname + '/../../attached_assets/stock_images/welcome_banner_backg_032929f9.jpg')
            };
            api.sendMessage(welcomeMessage, threadID);
          }
        }
      } else {
        // Welcome message if no ban list
        for (const participant of addedParticipants) {
          // Skip if bot was just added
          if (!botAdded) {
            const welcomeMessage = {
              body: `𝗪𝗲𝗹𝗰𝗼𝗺𝗲 to 𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 ${participant.fullName}\n𝗦𝗲𝗿𝘃𝗲𝗿to follow all the rules, you can see all the rules on our 𝗗𝗶𝘀𝗰𝗼𝗿𝗱 server\nhttps://discord.gg/WXpMxBEYYA\n\n𝗦𝗘𝗥𝗩𝗘𝗥 𝗜𝗡𝗙𝗢:\n𝗡𝗮𝗠𝗲: VexonSMP\n𝗜𝗣: vexonsmp.sereinhost.com\n𝗣𝗼𝗿𝘁: 25581\n\n• Feel free to invite your friends here on our server for more fun`,
              attachment: require('fs').createReadStream(__dirname + '/../../attached_assets/stock_images/welcome_banner_backg_032929f9.jpg')
            };
            api.sendMessage(welcomeMessage, threadID);
          }
        }
      }
    } catch (error) {
      logger.error('Error in auto-kick/welcome logic:', error);
    }
  }

  // Goodbye message
  if (event.type === "event" && event.logMessageType === 'log:unsubscribe') {
    const threadID = event.threadID;
    const leftParticipant = (event as any).logMessageData?.leftParticipantFbId;
    if (leftParticipant) {
      api.getUserInfo(leftParticipant, (err, userInfo) => {
        const name = userInfo && userInfo[leftParticipant] ? userInfo[leftParticipant].name : "A user";
        const goodbyeMessage = {
          body: `${name} has left the group. Goodluck to your Journey!`,
          attachment: require('fs').createReadStream(__dirname + '/../../attached_assets/stock_images/goodbye_banner_backg_ab2ebd2d.jpg')
        };
        api.sendMessage(goodbyeMessage, threadID);
      });
    }
  }
};

export const onEvent = async (
  api: IFCAU_API,
  event: ThreadEventType
): Promise<void> => {
};
