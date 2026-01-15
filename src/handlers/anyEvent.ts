import type { IFCAU_API, IFCAU_Attachment, IFCAU_ListenMessage } from '@dongdev/fca-unofficial';
import { MessageEventType } from '../../types';
import { Threads } from '../../database/controllers/threadController';
import { isAdmin, isOwner } from '../config';
import { logger } from '../utils/logger';

type SpamEntry = {
  lastSignature: string;
  count: number;
};

const ONE_HOUR_MS = 60 * 60 * 1000;

// threadID -> userID -> spam entry
const spamTracker = new Map<string, Map<string, SpamEntry>>();

const loadTempBans = async (threadID: string): Promise<{ settings: Record<string, any>; tempBans: Record<string, number>; now: number }> => {
  const settings = await Threads.getSettings(threadID);
  const rawTempBans = (settings as any).tempBans || {};
  const now = Date.now();

  const tempBans: Record<string, number> = {};

  for (const [id, until] of Object.entries(rawTempBans)) {
    if (typeof until === 'number' && until > now) {
      tempBans[id] = until;
    }
  }

  return { settings, tempBans, now };
};

const saveTempBans = async (threadID: string, settings: Record<string, any>, tempBans: Record<string, number>): Promise<void> => {
  (settings as any).tempBans = tempBans;
  await Threads.setSettings(threadID, settings);
};

const normalizeText = (text: string): string => text.trim().toLowerCase().replace(/\s+/g, ' ');

const normalizeAttachment = (attachment: IFCAU_Attachment): string => {
  const id = attachment.ID || '';
  const type = attachment.type?.toLowerCase?.() || 'unknown';
  return id ? `${type}:${id}` : type;
};

const buildMessageSignature = (event: MessageEventType): string | null => {
  const normalizedBody = normalizeText(event.body || '');
  const attachmentSignature = event.attachments?.length
    ? event.attachments.map(normalizeAttachment).filter(Boolean).join('|')
    : '';

  const parts = [normalizedBody, attachmentSignature].filter(Boolean);
  return parts.length ? parts.join('||') : null;
};

const getSpamEntry = (threadID: string, userID: string): SpamEntry => {
  let threadMap = spamTracker.get(threadID);
  if (!threadMap) {
    threadMap = new Map<string, SpamEntry>();
    spamTracker.set(threadID, threadMap);
  }

  let entry = threadMap.get(userID);
  if (!entry) {
    entry = { lastSignature: '', count: 0 };
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

  if (!threadID || !userID || !msgEvent.isGroup) return;
  // Do not police bot admins/owners or the bot itself
  if (isOwner(userID) || isAdmin(userID) || userID === String(api.getCurrentUserID())) {
    return;
  }

  const signature = buildMessageSignature(msgEvent);
  if (!signature) return;

  const entry = getSpamEntry(threadID, userID);

  if (entry.lastSignature === signature) {
    entry.count += 1;
  } else {
    entry.lastSignature = signature;
    entry.count = 1;
  }

  if (entry.count >= 5) {
    // Reset the tracker for this user after action
    entry.count = 0;
    entry.lastSignature = '';

    const removalError = await new Promise<Error | null>((resolve) => {
      api.removeUserFromGroup(userID, threadID, (err) => resolve(err || null));
    });

    if (removalError) {
      logger.warn(`Anti-spam: failed to kick ${userID} in ${threadID}:`, removalError);
      return;
    }

    // Apply a 1-hour temporary ban so the user cannot rejoin immediately
    const { settings, tempBans, now } = await loadTempBans(threadID);
    const banUntil = now + ONE_HOUR_MS;
    tempBans[userID] = banUntil;
    await saveTempBans(threadID, settings, tempBans);

    api.sendMessage(
      `🚫 Anti-spam: Removed user ${userID} for sending the same content 5 times. Temporary ban: 1 hour.`,
      threadID
    );
    logger.info(`Anti-spam: kicked ${userID} from ${threadID} and temp-banned for 1 hour (until ${new Date(banUntil).toISOString()})`);
  }
};
