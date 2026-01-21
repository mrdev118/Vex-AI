import type { IFCAU_API } from '@dongdev/fca-unofficial';
import { ThreadEventType } from '../../types';
import { logger } from '../utils/logger';
import { isGroupAdmin } from '../utils/permissions';
import { isOwner } from '../config';

const PROTECTED_GROUP_NAME = '𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 | Season 1 | Bedrock Only';

// Tracks the last known nickname per thread/user so we can restore it after blocked changes
const nicknameCache = new Map<string, Map<string, string>>();

// Tracks reverts initiated by the bot to avoid re-triggering on the bot's own nickname changes
const botRevertInProgress = new Set<string>();

// Cache to track recent nickname changes to prevent loops
const recentChanges = new Map<string, number>();
const CHANGE_COOLDOWN = 3000; // 3 seconds cooldown

// Fetch thread nicknames once per thread so we have a baseline to restore
const ensureThreadNicknamesCached = async (
  api: IFCAU_API,
  threadID: string,
  forceRefresh = false
): Promise<void> => {
  if (!forceRefresh && nicknameCache.has(threadID)) return;

  await new Promise<void>((resolve) => {
    api.getThreadInfo(threadID, (err, threadInfo) => {
      if (!err && threadInfo?.nicknames) {
        const map = new Map<string, string>();
        Object.entries(threadInfo.nicknames).forEach(([id, nickname]) => {
          map.set(id, nickname || '');
        });
        nicknameCache.set(threadID, map);
      } else {
        // Keep an empty cache entry so we do not refetch on every call
        nicknameCache.set(threadID, new Map());
        if (err) {
          logger.debug(`Failed to warm nickname cache for ${threadID}:`, err);
        }
      }
      resolve();
    });
  });
};

export const warmNicknameCache = async (
  api: IFCAU_API,
  threadID: string,
  forceRefresh = false
): Promise<void> => {
  await ensureThreadNicknamesCached(api, threadID, forceRefresh);
};

const getCachedNickname = (threadID: string, userID: string): string => {
  return nicknameCache.get(threadID)?.get(userID) ?? '';
};

const setCachedNickname = (threadID: string, userID: string, nickname: string): void => {
  if (!nicknameCache.has(threadID)) {
    nicknameCache.set(threadID, new Map());
  }
  nicknameCache.get(threadID)!.set(userID, nickname || '');
};

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

  const threadID = String(event.threadID);
  const author = String(event.author ?? '');
  const botID = String(api.getCurrentUserID?.() ?? '');
  const botRevertKey = (participantID: string): string => `${threadID}-${participantID}`;

  // Feature 1: Protect group chat name - only admins can change it
  if (event.logMessageType === 'log:thread-name') {
    try {
      const logData = (event as any).logMessageData;
      const newName = logData?.name || '';
      
      // Check if the author is a group admin or bot owner
      const isAuthorAdmin = await isGroupAdmin(api, author, threadID);
      const isAuthorOwner = isOwner(author);
      
      if (!isAuthorAdmin && !isAuthorOwner) {
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
                `━━━━━━━━━━━━━━━━━━━━\n⚠️ 𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 𝗦𝗲𝗰𝘂𝗿𝗶𝘁𝘆\n━━━━━━━━━━━━━━━━━━━━\n\n🚫 𝗔𝗰𝘁𝗶𝗼𝗻 𝗗𝗲𝗻𝗶𝗲𝗱!\nOnly group admins can change the group name.\n\n✅ Group name has been restored to:\n${PROTECTED_GROUP_NAME}\n\n━━━━━━━━━━━━━━━━━━━━`,
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

  // Feature 2: Protect group chat photo - only admins can change it
  if (event.logMessageType === 'log:thread-icon') {
    try {
      // Check if the author is a group admin
      const isAuthorAdmin = await isGroupAdmin(api, author, threadID);
      
      if (!isAuthorAdmin) {
        // Non-admin tried to change the group photo
        const changeKey = `thread-icon-${threadID}`;
        
        if (canMakeChange(changeKey)) {
          logger.info(`Group photo change detected by non-admin in ${threadID}`);
          api.sendMessage(
            `━━━━━━━━━━━━━━━━━━━━\n⚠️ 𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 𝗦𝗲𝗰𝘂𝗿𝗶𝘁𝘆\n━━━━━━━━━━━━━━━━━━━━\n\n🚫 𝗔𝗰𝘁𝗶𝗼𝗻 𝗗𝗲𝗻𝗶𝗲𝗱!\nOnly group admins can change the group photo.\n\n━━━━━━━━━━━━━━━━━━━━`,
            threadID
          );
        }
      }
    } catch (error) {
      logger.error('Error in group photo protection:', error);
    }
  }

  // Feature 3: Prevent members from changing other people's nicknames
  if (event.logMessageType === 'log:user-nickname') {
    try {
      await ensureThreadNicknamesCached(api, threadID);

      const logData = (event as any).logMessageData;
      const targetUserID = String(logData?.participant_id ?? '');
      const nickname = logData?.nickname || '';

      // If the user is changing their own nickname, accept and update cache
      if (author === targetUserID) {
        setCachedNickname(threadID, targetUserID, nickname || '');
        return;
      }

      // Ignore changes performed by the bot itself (e.g., when reverting nicknames)
      if (author && botID && author === botID) {
        setCachedNickname(threadID, targetUserID, nickname || '');
        botRevertInProgress.delete(botRevertKey(targetUserID));
        return;
      }

      // If this event is part of a bot-initiated revert, skip handling
      if (botRevertInProgress.has(botRevertKey(targetUserID))) {
        setCachedNickname(threadID, targetUserID, nickname || '');
        botRevertInProgress.delete(botRevertKey(targetUserID));
        return;
      }

      const isAuthorAdmin = await isGroupAdmin(api, author, threadID);
      const isAuthorOwner = isOwner(author);

      if (!isAuthorAdmin && !isAuthorOwner) {
        const changeKey = `nickname-${threadID}-${targetUserID}-${author}`;

        if (canMakeChange(changeKey)) {
          const previousNickname = getCachedNickname(threadID, targetUserID);
          const revertNickname = previousNickname ?? '';

          botRevertInProgress.add(botRevertKey(targetUserID));

          api.changeNickname(revertNickname, threadID, targetUserID, (err) => {
            if (err) {
              logger.error('Error reverting nickname:', err);
              botRevertInProgress.delete(botRevertKey(targetUserID));
              return;
            }

            // Keep cache aligned with the reverted nickname
            setCachedNickname(threadID, targetUserID, revertNickname);

            // Refresh cache in the background to pick up any other changes in the thread
            ensureThreadNicknamesCached(api, threadID, true).catch(() => {
              /* best effort */
            });

            logger.info(`Reverted nickname change for user ${targetUserID} in ${threadID}`);

            api.getUserInfo([author, targetUserID], (infoErr, userInfo) => {
              if (infoErr || !userInfo) return;

              const authorName = userInfo[author]?.name || 'Someone';
              const targetName = userInfo[targetUserID]?.name || 'another user';

              api.sendMessage(
                `━━━━━━━━━━━━━━━━━━━━\n⚠️ 𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 𝗦𝗲𝗰𝘂𝗿𝗶𝘁𝘆\n━━━━━━━━━━━━━━━━━━━━\n\n🚫 𝗔𝗰𝘁𝗶𝗼𝗻 𝗗𝗲𝗻𝗶𝗲𝗱!\n@${authorName}, you can only change your own nickname, not ${targetName}'s!\n\n✅ Nickname has been restored.\n\n━━━━━━━━━━━━━━━━━━━━`,
                threadID
              );
            });
          });
        }
      } else {
        // Admins/owners are allowed; update cache so we remember the new nickname
        setCachedNickname(threadID, targetUserID, nickname || '');
      }
    } catch (error) {
      logger.error('Error in nickname protection:', error);
    }
  }
};
