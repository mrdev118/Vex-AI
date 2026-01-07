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
          // Welcome message for non-banned users
          api.sendMessage(`Welcome ${participant.fullName} to the group! Have a great time here!`, threadID);
        }
      } else {
        // Welcome message if no ban list
        for (const participant of addedParticipants) {
          api.sendMessage(`Welcome ${participant.fullName} to the group! Have a great time here!`, threadID);
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
        api.sendMessage(`${name} has left the group. Goodbye!`, threadID);
      });
    }
  }
};

export const onEvent = async (
  api: IFCAU_API,
  event: ThreadEventType
): Promise<void> => {
};
