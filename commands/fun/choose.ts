import { client } from '../../src/client';
import { ICommand, IHandleParams, IRunParams } from '../../types';

const command: ICommand = {
  config: {
    name: "choose",
    version: "1.0.0",
    author: "Donix",
    description: "Example for handling replies and reactions",
    hasPrefix: true,
    category: "Fun"
  },

  run: async ({ api, event }: IRunParams) => {
    api.sendMessage(
      "🔴 Choose Team Red (reply to this message with 'red')\n🔵 Or Team Blue (react to this message with a heart)?",
      event.threadID,
      (err, info) => {
        if (err) return;

        if (!info) return;

        client.handleReplies.set(info.messageID, {
          messageID: info.messageID,
          name: "choose",
          author: event.senderID,
          type: "chon_phe"
        });

        client.handleReactions.set(info.messageID, {
          messageID: info.messageID,
          name: "choose",
          author: event.senderID,
          secretCode: 12345
        });
      }
    );
  },

  handleReply: async ({ api, event, handleReply, config }: IHandleParams) => {
    if (!handleReply) return;

    if (event.senderID !== handleReply.author) {
      api.sendMessage("It's not your turn for this choice!", event.threadID);
      return;
    }

    const answer = (event as any).body?.toLowerCase() || "";
    if (answer === "red") {
      api.sendMessage("🔥 Welcome to the fierce Team Red!", event.threadID);

      client.handleReplies.delete(handleReply.messageID);
    } else {
      api.sendMessage("That input doesn't work here—type 'red'.", event.threadID);
    }
  },

  handleReaction: async ({ api, event, handleReaction, config }: IHandleParams) => {
    if (!handleReaction) return;

    const reaction = (event as any).reaction;
    if (reaction === "❤" || reaction === "❤️") {
      api.sendMessage("🌊 Welcome to the chill Team Blue!", event.threadID);
      client.handleReactions.delete(handleReaction.messageID);
    }
  }
};

export = command;
