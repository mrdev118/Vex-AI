import { ICommand, IRunParams } from '../../types';

const command: ICommand = {
    config: {
        name: "uid",
        hasPrefix: true,
        description: "Get user UID",
        category: "Admin"
    },

    run: async ({ api, event }: IRunParams) => {
        api.sendMessage(`Your UID: ${event.senderID}`, event.threadID);
    }
};

export = command;
