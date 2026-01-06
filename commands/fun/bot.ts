import { ICommand, IRunParams } from '../../types';

const command: ICommand = {
    config: {
        name: "bot",
        hasPrefix: false,
        description: "Call bot and it replies",
        category: "Fun"
    },

    run: async ({ api, event }: IRunParams) => {
        const body = event.body.toLowerCase();

        if (body.includes("bot") || body === "bot" || body.includes("hello bot")) {
            api.sendMessage("Yes, I'm here? What do you need? It's 2026 and you're still not sleeping? 😊", event.threadID);
        }
    }
};

export = command;
