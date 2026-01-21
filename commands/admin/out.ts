import { ICommand, IHandleParams, IRunParams } from '../../types';
import { client } from '../../src/client';

const command: ICommand = {
  config: {
    name: "out",
    version: "1.0.0",
    author: "VexAI",
    description: "Leave the current group or pick a group to leave",
    category: "Admin",
    usages: ".out (leave here) | .out list",
    role: 2
  },

  run: async ({ api, event, args, send }: IRunParams): Promise<void> => {
    const subCommand = (args[0] || "").toLowerCase();

    // List all groups and let the user choose one to leave
    if (subCommand === "list") {
      api.getThreadList(100, null, ["INBOX"], (err, threads) => {
        if (err || !threads) {
          send("❌ Unable to fetch group list right now.");
          return;
        }

        const groups = threads
          .filter((thread: any) => thread.isGroup)
          .filter((thread: any) => thread.isSubscribed !== false && !thread.isArchived);

        if (groups.length === 0) {
          send("❌ No groups found.");
          return;
        }

        let message = "📂 Select a group for the bot to leave:\n\n";
        groups.forEach((thread: any, index: number) => {
          const name = thread.name || "Unnamed Group";
          message += `${index + 1}. ${name}\n`;
        });
        message += "\n↩️ Reply with a number to confirm which group I should leave.";

        api.sendMessage(message, event.threadID, (sendErr, info) => {
          if (sendErr || !info) return;

          client.handleReplies.set(info.messageID, {
            name: command.config.name,
            messageID: info.messageID,
            author: event.senderID,
            groups: groups.map((thread: any) => ({
              threadID: thread.threadID,
              name: thread.name || "Unnamed Group"
            }))
          });
        });

        return;
      });
      return;
    }

    // Default: leave the current group
    if (!event.isGroup) {
      await send("ℹ️ Use this in a group to make me leave, or run '.out list' to pick another group.");
      return;
    }

    const botID = api.getCurrentUserID();

    await send("👋 Leaving this group. Goodbye!");
    api.removeUserFromGroup(botID, event.threadID, (removeErr?: Error) => {
      if (removeErr) {
        send(`❌ I couldn't leave this group: ${removeErr.message}`);
      }
    });
  },

  handleReply: async ({ api, event, send, handleReply }: IHandleParams): Promise<void> => {
    if (!handleReply || event.senderID !== handleReply.author) return;

    const selection = parseInt((event as any).body?.trim() || "", 10);
    const groups = handleReply.groups as Array<{ threadID: string; name: string }>;

    if (!groups || isNaN(selection) || selection < 1 || selection > groups.length) {
      await send(`⚠️ Invalid choice. Please reply with a number between 1 and ${groups?.length || 0}.`);
      return;
    }

    const target = groups[selection - 1];
    const botID = api.getCurrentUserID();

    await send(`👋 Leaving ${target.name}...`);
    api.removeUserFromGroup(botID, target.threadID, (err?: Error) => {
      if (err) {
        send(`❌ Failed to leave ${target.name}: ${err.message}`);
      } else {
        send(`✅ Left ${target.name}.`);
      }
    });

    client.handleReplies.delete(handleReply.messageID);
  }
};

export = command;
