import { ICommand, IRunParams } from '../../types';

const command: ICommand = {
    config: {
        name: "uid",
        hasPrefix: true,
        description: "Get user UID",
        category: "Admin"
    },

    run: async ({ api, event }: IRunParams) => {
        const eventWithReply = event as any;
        const mentionIDs = event.mentions ? Object.keys(event.mentions) : [];

        const targetID = mentionIDs[0]
            || (eventWithReply.messageReply ? eventWithReply.messageReply.senderID : undefined)
            || event.senderID;

        const label = targetID === event.senderID ? 'Your UID' : 'User UID';
        api.sendMessage(`${label}: ${targetID}`, event.threadID);
    }
};

export = command;
