import { ICommand, IRunParams } from '../../types';
import { Threads } from '../../database/controllers/threadController';
import Thread from '../../database/models/Thread';

const command: ICommand = {
  config: {
    name: "banlist",
    version: "1.0.0",
    author: "GitHub Copilot",
    description: "View banned users for this group or globally",
    category: "Admin",
    usages: "!banlist [global]",
    role: 1
  },

  run: async ({ api, event, args, send }: IRunParams): Promise<void> => {
    const parseBanArray = (raw: unknown): string[] => {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw.map(id => String(id));
      try {
        const parsed = JSON.parse(String(raw));
        return Array.isArray(parsed) ? parsed.map(id => String(id)) : [];
      } catch {
        return [];
      }
    };

    const isGlobal = Array.isArray(args) && args[0] && ['global', 'all'].includes(args[0].toLowerCase());

    if (isGlobal) {
      try {
        const threads = await Thread.findAll({ attributes: ['threadID', 'name', 'bannedUsers'] });
        const groups = threads
          .map(t => ({ id: t.threadID, name: t.name || t.threadID, bans: parseBanArray(t.bannedUsers) }))
          .filter(g => g.bans.length > 0);

        if (groups.length === 0) {
          await send('✅ No groups currently have banned members.');
          return;
        }

        const totalBans = groups.reduce((sum, g) => sum + g.bans.length, 0);
        const lines: string[] = [
          `🚫 Global banned members: ${totalBans} across ${groups.length} group(s).`
        ];

        const MAX_LINES = 25;
        groups.slice(0, MAX_LINES).forEach(g => {
          const preview = g.bans.slice(0, 5).join(', ');
          const more = g.bans.length > 5 ? ` ...and ${g.bans.length - 5} more` : '';
          lines.push(`- ${g.name} (${g.id}): ${g.bans.length} [${preview}${more ? more : ''}]`);
        });

        if (groups.length > MAX_LINES) {
          lines.push(`(Truncated to ${MAX_LINES} groups)`);
        }

        lines.push('Use !banlist in a group to see the detailed list for that group.');

        await send(lines.join('\n'));
      } catch (error) {
        await send('❌ Failed to load global ban list.');
      }
      return;
    }

    if (!event.isGroup) {
      await send('This command can only be used in groups!');
      return;
    }

    try {
      const threadData = await Threads.getData(event.threadID);
      const bannedList = parseBanArray(threadData.bannedUsers);

      if (bannedList.length === 0) {
        await send('✅ There are no banned members in this group.');
        return;
      }

      const nameMap = await new Promise<Record<string, string>>((resolve) => {
        api.getUserInfo(bannedList, (err: Error | null, info: Record<string, { name?: string }> | undefined) => {
          if (err || !info) return resolve({});
          const map: Record<string, string> = {};
          for (const id of bannedList) {
            map[id] = info[id]?.name || id;
          }
          resolve(map);
        });
      });

      const lines = bannedList.map((id, index) => `${index + 1}. ${nameMap[id] || id} (${id})`);
      await send([`🚫 Banned members: ${bannedList.length}`, ...lines, 'Use !unban <userID> to remove a user.'].join('\n'));
    } catch (error) {
      await send('❌ Failed to load ban list.');
    }
  }
};

export = command;
