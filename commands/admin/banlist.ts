import { ICommand, IRunParams } from '../../types';
import { Threads } from '../../database/controllers/threadController';

const command: ICommand = {
  config: {
    name: "banlist",
    version: "1.0.0",
    author: "GitHub Copilot",
    description: "View banned users for this group",
    category: "Admin",
    usages: "!banlist",
    role: 1
  },

  run: async ({ api, event, send }: IRunParams): Promise<void> => {
    if (!event.isGroup) {
      await send("This command can only be used in groups!");
      return;
    }

    try {
      const threadData = await Threads.getData(event.threadID);
      let bannedList: string[] = [];

      try {
        const parsed = JSON.parse(threadData.bannedUsers || "[]");
        bannedList = Array.isArray(parsed) ? parsed.map((id: any) => String(id)) : [];
      } catch {
        bannedList = [];
      }

      if (bannedList.length === 0) {
        await send("✅ There are no banned members in this group.");
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
      await send([`🚫 Banned members: ${bannedList.length}`, ...lines, "Use !unban <userID> to remove a user."].join("\n"));
    } catch (error) {
      await send("❌ Failed to load ban list.");
    }
  }
};

export = command;
