import { ICommand, IRunParams } from '../../types';
import { OWNER_ID, isOwner } from '../../src/config';

const command: ICommand = {
  config: {
    name: "clearnonick",
    aliases: ["cnn"],
    version: "1.0.0",
    author: "GitHub Copilot",
    description: "Remove all non-admin members without a nickname",
    category: "Admin",
    usages: "!clearnonick",
    role: 1 // Group Admin
  },

  run: async ({ api, event, send }: IRunParams) => {
    if (!event.isGroup) {
      await send("This command can only be used in groups!");
      return;
    }

    const threadInfo = await new Promise<any>((resolve, reject) => {
      api.getThreadInfo(event.threadID, (err, info) => {
        if (err || !info) return reject(err || new Error("Unable to fetch thread info"));
        resolve(info);
      });
    }).catch(async (error: any) => {
      await send(`❌ Failed to load group info: ${error?.message || error}`);
      return null;
    });

    if (!threadInfo) return;

    const participantIDs: string[] = (threadInfo.participantIDs || []).map((id: any) => String(id));
    const adminIDs: string[] = (threadInfo.adminIDs || []).map((id: any) => String(id));
    const nicknames: Record<string, string> = threadInfo.nicknames || {};
    const botID = String(api.getCurrentUserID());

    const candidates = participantIDs.filter((id) => {
      if (!id) return false;
      if (id === botID) return false;
      if (isOwner(id) || id === OWNER_ID) return false;
      if (adminIDs.includes(id)) return false;
      const nickname = nicknames[id];
      return !nickname || nickname.trim() === '';
    });

    if (candidates.length === 0) {
      await send("✅ Everyone already has a nickname. No users were removed.");
      return;
    }

    const userInfo = await new Promise<Record<string, { name?: string }>>((resolve) => {
      api.getUserInfo(candidates, (_err, info) => resolve((info as any) || {}));
    });

    const removed: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    for (const id of candidates) {
      // Sequential removal keeps error reporting predictable
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>((resolve) => {
        api.removeUserFromGroup(id, event.threadID, (err?: Error) => {
          if (err) {
            failed.push({ id, reason: err.message || 'Unknown error' });
          } else {
            removed.push(id);
          }
          resolve();
        });
      });
    }

    const removedLines = removed.map((id) => `• ${userInfo[id]?.name || 'User'} (${id})`).join('\n');
    const failedLines = failed.map((f) => `• ${userInfo[f.id]?.name || f.id}: ${f.reason}`).join('\n');

    const parts = [
      `✅ Removed ${removed.length} user(s) without nicknames.`,
      removedLines ? `\n${removedLines}` : '',
      failed.length ? `\n⚠️ Failed to remove ${failed.length} user(s):\n${failedLines}` : ''
    ].filter(Boolean);

    await send(parts.join('\n'));
  }
};

export = command;
