import { ICommand, IRunParams } from '../../types';
import { Threads } from '../../database/controllers/threadController';
import Thread from '../../database/models/Thread';

const THREAD_TAGS: ReadonlyArray<'INBOX' | 'OTHER' | 'PENDING' | 'ARCHIVED'> = ['INBOX', 'OTHER', 'PENDING', 'ARCHIVED'];

const extractMentionedUserID = (mentions: any): string | null => {
  if (!mentions) return null;

  if (Array.isArray(mentions)) {
    const first = mentions[0];
    if (!first) return null;
    if (typeof first === 'string') return first;
    if (typeof first === 'object') {
      if (first.id) return String(first.id);
      if (first.uid) return String(first.uid);
    }
    return null;
  }

  const mentionKeys = Object.keys(mentions);
  if (mentionKeys.length === 0) return null;

  const firstKey = mentionKeys[0];
  const firstValue = (mentions as any)[firstKey];

  if (firstValue && typeof firstValue === 'object') {
    if (firstValue.id) return String(firstValue.id);
    if (firstValue.uid) return String(firstValue.uid);
  }

  return firstKey || null;
};

const parseReason = (args: string[], consumed: number): string => {
  if (args.length <= consumed) return '';
  return args.slice(consumed).join(' ').trim();
};

const parseBans = (raw: unknown): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(id => String(id));
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed.map(id => String(id)) : [];
  } catch {
    return [];
  }
};

const getGroupThreads = async (api: any, pageSize = 25, maxPagesPerTag = 8): Promise<Array<{ threadID: string; name?: string }>> => {
  const seen = new Set<string>();
  const results: Array<{ threadID: string; name?: string }> = [];

  for (const tag of THREAD_TAGS) {
    let cursor: number | null = null;

    for (let page = 0; page < maxPagesPerTag; page++) {
      const batch = await new Promise<any[]>((resolve, reject) => {
        api.getThreadList(pageSize, cursor, [tag], (err: any, threads: any[]) => {
          if (err) return reject(err);
          resolve(threads || []);
        });
      });

      if (!batch.length) break;

      for (const raw of batch) {
        if (!raw?.isGroup) continue;
        const id = String(raw.threadID || raw.thread_id || '');
        if (!id || seen.has(id)) continue;
        seen.add(id);
        results.push({ threadID: id, name: raw.name });
      }

      if (batch.length < pageSize) break;

      const last = batch[batch.length - 1] as any;
      const nextCursor = Number(last?.timestamp ?? last?.lastMessageTimestamp ?? last?.messageCount);
      if (!Number.isFinite(nextCursor)) break;
      cursor = nextCursor;
    }
  }

  return results;
};

const command: ICommand = {
  config: {
    name: 'banall',
    version: '1.0.0',
    author: 'GitHub Copilot',
    description: 'Ban a user from every group the bot is in',
    category: 'Admin',
    usages: '.banall @user [reason]',
    role: 3 // Owner only
  },

  run: async ({ api, event, args, send }: IRunParams): Promise<void> => {
    const eventWithReply = event as any;

    let targetID = '';
    let consumedArgs = 0;

    if (eventWithReply.messageReply) {
      targetID = eventWithReply.messageReply.senderID;
    }

    if (!targetID) {
      const mentioned = extractMentionedUserID((event as any).mentions);
      if (mentioned) {
        targetID = mentioned;
      }
    }

    if (!targetID && args[0]) {
      targetID = args[0].replace('@', '').trim();
      consumedArgs = 1;
    }

    if (!targetID) {
      await send('Tag a user, reply to their message, or provide a user ID to ban across all groups.');
      return;
    }

    if (targetID === event.senderID) {
      await send('You cannot ban yourself.');
      return;
    }

    if (targetID === api.getCurrentUserID()) {
      await send('I cannot ban myself.');
      return;
    }

    const reason = parseReason(args, consumedArgs);

    await send('Scanning groups and applying global ban...');

    try {
      // Ensure we have DB entries for all threads we know about
      const allThreads = await Thread.findAll({ attributes: ['threadID', 'name', 'bannedUsers'] });
      const knownIDs = new Set(allThreads.map(t => String(t.threadID)));

      // Build list of group threads from API
      const groups = await getGroupThreads(api);
      for (const g of groups) {
        if (!knownIDs.has(g.threadID)) {
          knownIDs.add(g.threadID);
        }
      }

      let bansUpdated = 0;
      let alreadyBanned = 0;
      let kicksSucceeded = 0;
      let kicksFailed = 0;

      for (const threadID of knownIDs) {
        const threadRecord = await Threads.getData(threadID);
        let bannedList = parseBans(threadRecord.bannedUsers);

        if (!bannedList.includes(targetID)) {
          bannedList.push(targetID);
          threadRecord.bannedUsers = JSON.stringify(bannedList);
          await threadRecord.save();
          bansUpdated += 1;
        } else {
          alreadyBanned += 1;
        }

        // Try to remove if present; ignore errors like "not in group"
        await new Promise<void>((resolve) => {
          api.removeUserFromGroup(targetID, threadID, (err?: any) => {
            if (err) {
              kicksFailed += 1;
              return resolve();
            }
            kicksSucceeded += 1;
            resolve();
          });
        });
      }

      const lines = [
        `✅ Global ban applied for ${targetID}.`,
        `Groups updated: ${bansUpdated}`,
        `Already banned groups: ${alreadyBanned}`,
        `Kick attempts: success ${kicksSucceeded}, failed ${kicksFailed}`
      ];

      if (reason) {
        lines.push(`Reason: ${reason}`);
      }

      await send(lines.join('\n'));
    } catch (error: any) {
      await send(`❌ Failed to apply global ban: ${error?.message || error}`);
    }
  }
};

export = command;
