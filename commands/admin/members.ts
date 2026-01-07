import { ICommand, IRunParams } from '../../types';

const command: ICommand = {
  config: {
    name: "members",
    hasPrefix: true,
    description: "Get all group members with their UIDs",
    category: "Admin",
    role: 1,
    usages: "members"
  },

  run: async ({ api, event }: IRunParams): Promise<void> => {
    const { threadID, isGroup } = event;

    if (!isGroup) {
      api.sendMessage("⚠️ This command can only be used in group chats!", threadID);
      return;
    }

    try {
      api.sendMessage("🔄 Fetching member list...", threadID);

      api.getThreadInfo(threadID, async (err, threadInfo) => {
        if (err || !threadInfo) {
          api.sendMessage("❌ Failed to get group information!", threadID);
          return;
        }

        const participantIDs = threadInfo.participantIDs || [];
        
        if (participantIDs.length === 0) {
          api.sendMessage("❌ No members found in this group!", threadID);
          return;
        }

        // Get user information for all participants
        api.getUserInfo(participantIDs, (err, userInfo) => {
          if (err || !userInfo) {
            api.sendMessage("❌ Failed to get member information!", threadID);
            return;
          }

          let message = `𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 𝗠𝗲𝗺𝗯𝗲𝗿 𝗟𝗶𝘀𝘁\n\n`;
          message += `👥 Total Members: ${participantIDs.length}\n\n`;

          // Sort members alphabetically by name
          const sortedMembers = participantIDs
            .map(id => ({
              id,
              name: userInfo[id]?.name || 'Unknown User'
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

          sortedMembers.forEach((member, index) => {
            message += `${index + 1}. ${member.name}\n`;
            message += `📱 UID: ${member.id}\n\n`;
          });

          api.sendMessage(message, threadID);
        });
      });
    } catch (error) {
      api.sendMessage("❌ An error occurred while fetching member list!", threadID);
    }
  }
};

export = command;
