import type { IFCAU_API } from '@dongdev/fca-unofficial';
import { ThreadEventType } from '../../types';
import { logger } from '../utils/logger';
import { isGroupAdmin } from '../utils/permissions';

const PROTECTED_GROUP_NAME = '𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 | Season 1 | Bedrock Only';

// Cache to track recent nickname changes to prevent loops
const recentChanges = new Map<string, number>();
const CHANGE_COOLDOWN = 3000; // 3 seconds cooldown

const canMakeChange = (key: string): boolean => {
  const lastChange = recentChanges.get(key);
  const now = Date.now();
  
  if (lastChange && now - lastChange < CHANGE_COOLDOWN) {
    return false;
  }
  
  recentChanges.set(key, now);
  
  // Clean up old entries
  setTimeout(() => {
    recentChanges.delete(key);
  }, CHANGE_COOLDOWN + 1000);
  
  return true;
};

export const handleNicknameProtection = async (
  api: IFCAU_API,
  event: ThreadEventType
): Promise<void> => {
  if (event.type !== "event") return;

  const threadID = event.threadID;
  const author = event.author;

  // Feature 1: Protect group chat name - only admins can change it
  if (event.logMessageType === 'log:thread-name') {
    try {
      const logData = (event as any).logMessageData;
      const newName = logData?.name || '';
      
      // Check if the author is a group admin
      const isAuthorAdmin = await isGroupAdmin(api, author, threadID);
      
      if (!isAuthorAdmin) {
        // Non-admin tried to change the group name
        const changeKey = `thread-name-${threadID}`;
        
        if (canMakeChange(changeKey)) {
          // Revert the name back to protected name
          api.setTitle(PROTECTED_GROUP_NAME, threadID, (err) => {
            if (err) {
              logger.error('Error reverting group name:', err);
            } else {
              logger.info(`Group name restored to protected name in ${threadID}`);
              api.sendMessage(
                `⚠️ Only group admins can change the group name!\n\n✅ Group name restored to: ${PROTECTED_GROUP_NAME}`,
                threadID
              );
            }
          });
        }
      }
    } catch (error) {
      logger.error('Error in group name protection:', error);
    }
  }

  // Feature 2: Prevent members from changing other people's nicknames
  if (event.logMessageType === 'log:user-nickname') {
    try {
      const logData = (event as any).logMessageData;
      const targetUserID = logData?.participant_id || '';
      const nickname = logData?.nickname || '';
      
      // If someone tries to change another person's nickname (not their own)
      if (author !== targetUserID) {
        // Check if the author is a group admin
        const isAuthorAdmin = await isGroupAdmin(api, author, threadID);
        
        if (!isAuthorAdmin) {
          // Non-admin tried to change someone else's nickname
          const changeKey = `nickname-${threadID}-${targetUserID}-${author}`;
          
          if (canMakeChange(changeKey)) {
            // Get the target user's previous nickname
            api.getThreadInfo(threadID, (err, threadInfo) => {
              if (err || !threadInfo) {
                logger.error('Error getting thread info:', err);
                return;
              }

              // Find the participant's original nickname
              const participants = threadInfo.nicknames || {};
              const previousNickname = participants[targetUserID] || '';
              
              // Revert the nickname change
              api.changeNickname(previousNickname, threadID, targetUserID, (err) => {
                if (err) {
                  logger.error('Error reverting nickname:', err);
                } else {
                  logger.info(`Reverted nickname change for user ${targetUserID} in ${threadID}`);
                  
                  // Get user names for the message
                  api.getUserInfo([author, targetUserID], (err, userInfo) => {
                    if (err || !userInfo) return;
                    
                    const authorName = userInfo[author]?.name || 'Someone';
                    const targetName = userInfo[targetUserID]?.name || 'another user';
                    
                    api.sendMessage(
                      `⚠️ @${authorName}, you can only change your own nickname, not ${targetName}'s!\n\n✅ Nickname restored.`,
                      threadID
                    );
                  });
                }
              });
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error in nickname protection:', error);
    }
  }
};
