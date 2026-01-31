import { ICommand, IRunParams } from '../../types';

const command: ICommand = {
  config: {
    name: 'userinfo',
    version: '1.0.0',
    author: 'GitHub Copilot',
    description: 'Show basic info about a user (admin only)',
    category: 'Admin',
    usages: 'userinfo [@tag|reply|userID]',
    role: 1 // Group Admin
  },

  run: async ({ api, event, args, send }: IRunParams) => {
    const eventWithReply = event as any;

    let targetID = '';

    if (eventWithReply?.messageReply?.senderID) {
      targetID = String(eventWithReply.messageReply.senderID);
    } else if (event.mentions && Object.keys(event.mentions).length > 0) {
      targetID = Object.keys(event.mentions)[0];
    } else if (args[0]) {
      targetID = args[0].replace('@', '').trim();
    }

    if (!targetID) {
      targetID = String(event.senderID);
    }

    try {
      const info = await new Promise<Record<string, any>>((resolve, reject) => {
        api.getUserInfo(targetID, (err: Error | null, data: Record<string, any> | null) => {
          if (err || !data) return reject(err || new Error('No info'));
          resolve(data as Record<string, any>);
        });
      });

      const user = info[targetID] || {};
      const name = user.name || 'Unknown';
      const gender = typeof user.gender === 'string' ? user.gender : 'Unknown';
      const vanity = user.vanity || '';
      const profileUrl = vanity ? `https://facebook.com/${vanity}` : `https://facebook.com/${targetID}`;
      const isFriend = user.isFriend === true ? 'Yes' : 'No';
      const isBirthday = user.isBirthday === true ? 'Yes' : 'No';

      const message = [
        '📇 USER INFO',
        `👤 Name: ${name}`,
        `🆔 ID: ${targetID}`,
        `⚧️ Gender: ${gender}`,
        `🔗 Profile: ${profileUrl}`,
        `✅ Friend: ${isFriend}`,
        `🎂 Birthday today: ${isBirthday}`
      ].join('\n');

      await send(message);
    } catch (error: any) {
      await send(`❌ Unable to fetch user info: ${error?.message || error || 'unknown error'}`);
    }
  }
};

export = command;
