import type { IFCAU_API } from '@dongdev/fca-unofficial';
import { ICommand, ThreadEventType } from '../../types';
import { client } from '../client';
import { logger } from '../utils/logger';
import { Users } from '../../database/controllers/userController';
import { Threads } from '../../database/controllers/threadController';
import { warmNicknameCache } from './nicknameProtection';
import * as fs from 'fs';
import * as path from 'path';

export const handleEvent = async (
  api: IFCAU_API,
  event: ThreadEventType
): Promise<void> => {
  const threadID = String(event.threadID);
  const currentUserID = String(api.getCurrentUserID());
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
    const addedParticipantsRaw = (event as any).logMessageData?.addedParticipants || [];
    const addedParticipants = addedParticipantsRaw
      .map((p: any) => ({
        id: String(p.userFbId ?? p.userFbID ?? p.id ?? p.uid ?? ''),
        fullName: String(p.fullName ?? p.name ?? '')
      }))
      .filter((p: { id: string }) => p.id);
    
    try {
      // Check if bot was just added to the group
      const botAdded = addedParticipants.some((p: any) => p.id === currentUserID);
      
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
        bannedList = JSON.parse(threadData.bannedUsers || "[]").map((id: any) => String(id));
      } catch (e) {
        bannedList = [];
      }

      // Load temporary bans (e.g., spam auto-bans) and drop expired ones
      const settings = await Threads.getSettings(threadID);
      const rawTempBans = (settings as any).tempBans || {};
      const now = Date.now();
      const tempBans: Record<string, number> = {};
      let tempBansChanged = false;

      for (const [id, until] of Object.entries(rawTempBans)) {
        if (typeof until === 'number' && until > now) {
          tempBans[id] = until;
        } else {
          tempBansChanged = true;
        }
      }
      if (tempBansChanged) {
        (settings as any).tempBans = tempBans;
        await Threads.setSettings(threadID, settings);
      }

      // Process each added participant
      for (const participant of addedParticipants) {
        const userFbId = participant.id;
        
        // Skip if this is the bot itself
        if (userFbId === currentUserID) {
          continue;
        }
        
        const participantName = participant.fullName || 'A user';
        logger.info(`Processing new participant: ${participantName} (${userFbId}) in group ${threadID}`);
        
        // Check if user is permanently or temporarily banned
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

        const tempBanUntil = tempBans[userFbId];
        if (tempBanUntil && tempBanUntil > now) {
          const minutesLeft = Math.max(1, Math.ceil((tempBanUntil - now) / (60 * 1000)));
          logger.info(`User ${userFbId} is temporarily banned for spam, attempting to kick...`);
          api.removeUserFromGroup(userFbId, threadID, (err) => {
            if (!err) {
              api.sendMessage(
                `🚫 Auto-kick: ${participant.fullName || 'User'} (${userFbId}) is temporarily banned for spam. Time remaining: ${minutesLeft} minute(s).`,
                threadID
              );
              logger.info(`Auto-kicked temp-banned user ${userFbId} from group ${threadID}`);
            } else {
              logger.error(`Failed to kick temp-banned user ${userFbId}:`, err);
            }
          });
          continue;
        }
        
        // Send welcome message for non-banned users
        logger.info(`Sending welcome message for ${participantName}`);
        const welcomePath = path.join(process.cwd(), 'attached_assets/welcome.jpg');
        if (fs.existsSync(welcomePath)) {
          const welcomeMessage = {
            body: `𝗪𝗲𝗹𝗰𝗼𝗺𝗲 to 𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣, ${participantName}!\nTime to grind your 𝗞𝗶𝗹𝗹𝘀.\n\n𝗝𝗼𝗶𝗻 𝗢𝘂𝗿 𝗗𝗶𝘀𝗰𝗼𝗿𝗱: https://discord.gg/WXpMxBEYYA`,
            attachment: fs.createReadStream(welcomePath)
          };
          api.sendMessage(welcomeMessage, threadID, (err) => {
            if (err) {
              logger.error(`Error sending welcome message for ${participantName}:`, err);
            } else {
              logger.info(`Welcome message sent for ${participantName}`);
            }
          });
        } else {
          logger.warn(`Welcome image not found at ${welcomePath}`);
          api.sendMessage(`𝗪𝗲𝗹𝗰𝗼𝗺𝗲 to 𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣, ${participantName}!\nTime to grind your 𝗞𝗶𝗹𝗹𝘀.\n\n𝗝𝗼𝗶𝗻 𝗢𝘂𝗿 𝗗𝗶𝘀𝗰𝗼𝗿𝗱: https://discord.gg/WXpMxBEYYA`, threadID);
        }
      }
    } catch (error) {
      logger.error('Error in auto-kick/welcome logic:', error);
    }

    // Refresh nickname cache to include any newly added users
    await warmNicknameCache(api, threadID, true);
  }

  // Goodbye message
  if (event.type === "event" && event.logMessageType === 'log:unsubscribe') {
    const logData = (event as any).logMessageData || {};
    const leftParticipantRaw =
      logData.leftParticipantFbId ||
      logData.removedParticipantFbId ||
      (Array.isArray(logData.removedParticipants) ? logData.removedParticipants[0]?.userFbId || logData.removedParticipants[0] : undefined);

    const leftParticipant = leftParticipantRaw ? String(leftParticipantRaw) : undefined;

    if (!leftParticipant) {
      logger.warn(`No participant information found in unsubscribe event for group ${threadID}`);
      return;
    }

    if (leftParticipant === currentUserID) {
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

    await warmNicknameCache(api, threadID, true);
  }
};

export const onEvent = async (
  api: IFCAU_API,
  event: ThreadEventType
): Promise<void> => {
};
