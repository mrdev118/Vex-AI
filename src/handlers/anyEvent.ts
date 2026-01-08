import type { IFCAU_API, IFCAU_ListenMessage } from '@dongdev/fca-unofficial';
import { MessageEventType } from '../../types';
import { isAdmin, isOwner } from '../config';
import { logger } from '../utils/logger';

type SpamEntry = {
  lastMessage: string;
  count: number;
};

// threadID -> userID -> spam entry
const spamTracker = new Map<string, Map<string, SpamEntry>>();

const normalizeMessage = (text: string): string => text.trim().toLowerCase().replace(/\s+/g, ' ');

const getSpamEntry = (threadID: string, userID: string): SpamEntry => {
  let threadMap = spamTracker.get(threadID);
  if (!threadMap) {
    threadMap = new Map<string, SpamEntry>();
    spamTracker.set(threadID, threadMap);
  }

  let entry = threadMap.get(userID);
  if (!entry) {
    entry = { lastMessage: '', count: 0 };
    threadMap.set(userID, entry);
  }

  return entry;
};

export const handleAnyEvent = async (
  api: IFCAU_API,
  event: IFCAU_ListenMessage
): Promise<void> => {
  if (event.type !== 'message') return;

  const msgEvent = event as MessageEventType;
  const threadID = String(msgEvent.threadID || '');
  const userID = String(msgEvent.senderID || '');
  const body = (msgEvent.body || '').trim();

  if (!threadID || !userID || !msgEvent.isGroup) return;
  if (!body) return;

  // Do not police bot admins/owners or the bot itself
  if (isOwner(userID) || isAdmin(userID) || userID === String(api.getCurrentUserID())) {
    return;
  }

  const normalized = normalizeMessage(body);
  if (!normalized) return;

  const entry = getSpamEntry(threadID, userID);

  if (entry.lastMessage === normalized) {
    entry.count += 1;
  } else {
    entry.lastMessage = normalized;
    entry.count = 1;
  }

  if (entry.count >= 5) {
    // Reset the tracker for this user after action
    entry.count = 0;
    entry.lastMessage = '';

    api.removeUserFromGroup(userID, threadID, (err) => {
      if (err) {
        logger.warn(`Anti-spam: failed to kick ${userID} in ${threadID}:`, err);
        return;
      }

      api.sendMessage(
        `🚫 Anti-spam: Removed user ${userID} for sending the same message 5 times.`,
        threadID
      );
      logger.info(`Anti-spam: kicked ${userID} from ${threadID}`);
    });
  }
};
