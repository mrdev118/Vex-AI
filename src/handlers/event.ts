import type { IFCAU_API } from '@dongdev/fca-unofficial';
import { ICommand, ThreadEventType } from '../../types';
import { client } from '../client';
import { logger } from '../utils/logger';
import { Users } from '../../database/controllers/userController';
import { Threads } from '../../database/controllers/threadController';
import * as fs from 'fs';
import * as path from 'path';

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

  // Auto-kick logic for banned users and welcome messages
  if (event.type === "event" && event.logMessageType === 'log:subscribe') {
    const threadID = event.threadID;
    const addedParticipants = (event as any).logMessageData?.addedParticipants || [];
    
    try {
      // Check if bot was just added to the group
      const botAdded = addedParticipants.some((p: any) => p.userFbId === api.getCurrentUserID());
      
      if (botAdded) {
        logger.info(`Bot was added to group ${threadID}`);
        
        // Note: Facebook may not allow bots to change their own nicknames in all groups
        // Attempting to set bot nickname with delay
        setTimeout(() => {
          api.changeNickname("𝗩𝗲𝘅 𝗔𝗜 [ . ]", threadID, api.getCurrentUserID(), (err) => {
            if (err) {
              logger.warn(`Could not set bot nickname in group ${threadID} (Facebook restriction):`, err);
            } else {
              logger.info(`Bot nickname change requested for group ${threadID} - may require manual approval`);
            }
          });
        }, 3000);
        
        // Send bot connected message with image
        const connectedPath = path.join(process.cwd(), 'attached_assets/connected.gif');
        if (fs.existsSync(connectedPath)) {
          api.sendMessage({
            body: `✅ 𝗕𝗢𝗧 𝗖𝗢𝗡𝗡𝗘𝗖𝗧𝗘𝗗\n\nHello! I'm 𝗩𝗲𝘅 𝗔𝗜. I'm here to help manage your group with amazing commands and features.\n\nUse ".help" to see all available commands!\n\nServer IP: vexonsmp.sereinhost.com:25581\n\n💡 Tip: Group admins can manually set my nickname to "𝗩𝗲𝘅 𝗔𝗜 [ . ]"`,
            attachment: fs.createReadStream(connectedPath)
          }, threadID, (err) => {
            if (err) {
              logger.error('Error sending connected message:', err);
            } else {
              logger.info(`Connected message with GIF sent to group ${threadID}`);
            }
          });
        } else {
          logger.warn(`Connected image not found at ${connectedPath}`);
          api.sendMessage(`✅ 𝗕𝗢𝗧 𝗖𝗢𝗡𝗡𝗘𝗖𝗧𝗘𝗗\n\nHello! I'm 𝗩𝗲𝘅 𝗔𝗜. I'm here to help manage your group with amazing commands and features.\n\nUse ".help" to see all available commands!\n\nServer IP: vexonsmp.sereinhost.com:25581\n\n💡 Tip: Group admins can manually set my nickname to "𝗩𝗲𝘅 𝗔𝗜 [ . ]"`, threadID);
        }
        // Don't return here - continue to process other participants if any
      }
      
      const threadData = await Threads.getData(threadID);
      let bannedList: string[] = [];
      try {
        bannedList = JSON.parse(threadData.bannedUsers || "[]");
      } catch (e) {
        bannedList = [];
      }

      // Process each added participant
      for (const participant of addedParticipants) {
        const userFbId = participant.userFbId;
        
        // Skip if this is the bot itself
        if (userFbId === api.getCurrentUserID()) {
          continue;
        }
        
        logger.info(`Processing new participant: ${participant.fullName} (${userFbId}) in group ${threadID}`);
        
        // Check if user is banned
        if (bannedList.includes(userFbId)) {
          logger.info(`User ${userFbId} is banned, attempting to kick...`);
          api.removeUserFromGroup(userFbId, threadID, (err) => {
            if (!err) {
              api.sendMessage(`🚫 Auto-kick: User ${participant.fullName} (${userFbId}) is permanently banned from this group.`, threadID);
              logger.info(`Auto-kicked banned user ${userFbId} from group ${threadID}`);
            } else {
              logger.error(`Failed to kick banned user ${userFbId}:`, err);
            }
          });
          continue;
        }
        
        // Send welcome message for non-banned users
        logger.info(`Sending welcome message for ${participant.fullName}`);
        const welcomePath = path.join(process.cwd(), 'attached_assets/welcome.jpg');
        if (fs.existsSync(welcomePath)) {
          const welcomeMessage = {
            body: `𝗪𝗲𝗹𝗰𝗼𝗺𝗲 to 𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣, ${participant.fullName}!\nTime to grind your 𝗞𝗶𝗹𝗹𝘀.\n\n𝗝𝗼𝗶𝗻 𝗢𝘂𝗿 𝗗𝗶𝘀𝗰𝗼𝗿𝗱: https://discord.gg/WXpMxBEYYA`,
            attachment: fs.createReadStream(welcomePath)
          };
          api.sendMessage(welcomeMessage, threadID, (err) => {
            if (err) {
              logger.error(`Error sending welcome message for ${participant.fullName}:`, err);
            } else {
              logger.info(`Welcome message sent for ${participant.fullName}`);
            }
          });
        } else {
          logger.warn(`Welcome image not found at ${welcomePath}`);
          api.sendMessage(`𝗪𝗲𝗹𝗰𝗼𝗺𝗲 to 𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣, ${participant.fullName}!\nTime to grind your 𝗞𝗶𝗹𝗹𝘀.\n\n𝗝𝗼𝗶𝗻 𝗢𝘂𝗿 𝗗𝗶𝘀𝗰𝗼𝗿𝗱: https://discord.gg/WXpMxBEYYA`, threadID);
        }
      }
    } catch (error) {
      logger.error('Error in auto-kick/welcome logic:', error);
    }
  }

  // Goodbye message
  if (event.type === "event" && event.logMessageType === 'log:unsubscribe') {
    const threadID = event.threadID;
    const logData = (event as any).logMessageData || {};
    const leftParticipant =
      logData.leftParticipantFbId ||
      logData.removedParticipantFbId ||
      (Array.isArray(logData.removedParticipants) ? logData.removedParticipants[0]?.userFbId || logData.removedParticipants[0] : undefined);

    if (!leftParticipant) {
      logger.warn(`No participant information found in unsubscribe event for group ${threadID}`);
      return;
    }

    if (leftParticipant === api.getCurrentUserID()) {
      logger.info(`Bot was removed from group ${threadID}, skipping goodbye message.`);
      return;
    }

    const goodbyePath = path.join(process.cwd(), 'attached_assets/goodbye.jpeg');
    const sendGoodbye = (name: string): void => {
      if (fs.existsSync(goodbyePath)) {
        const goodbyeMessage = {
          body: `${name} has 𝗗𝗶𝘀𝗰𝗼𝗻𝗻𝗲𝗰𝘁𝗲𝗱. Was it a 𝗥𝗮𝗴𝗲 𝗤𝘂𝗶𝘁?`,
          attachment: fs.createReadStream(goodbyePath)
        };
        api.sendMessage(goodbyeMessage, threadID, (err) => {
          if (err) {
            logger.error(`Error sending goodbye message for ${name}:`, err);
          } else {
            logger.info(`Goodbye message sent for ${name}`);
          }
        });
      } else {
        logger.warn(`Goodbye image not found at ${goodbyePath}`);
        api.sendMessage(`${name} has 𝗗𝗶𝘀𝗰𝗼𝗻𝗻𝗲𝗰𝘁𝗲𝗱. Was it a 𝗥𝗮𝗴𝗲 𝗤𝘂𝗶𝘁?`, threadID);
      }
    };

    logger.info(`User ${leftParticipant} left group ${threadID}`);
    api.getUserInfo(leftParticipant, (err, userInfo) => {
      if (err) {
        logger.error(`Error getting user info for ${leftParticipant}:`, err);
        sendGoodbye('A user');
        return;
      }

      const name = userInfo && userInfo[leftParticipant] ? userInfo[leftParticipant].name : 'A user';
      logger.info(`Sending goodbye message for ${name}`);
      sendGoodbye(name);
    });
  }
};

export const onEvent = async (
  api: IFCAU_API,
  event: ThreadEventType
): Promise<void> => {
};
