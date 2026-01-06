import { ICommand, IRunParams } from '../../types';

const command: ICommand = {
    config: {
        name: "ping",
        version: "1.0.0",
        author: "Donix",
        description: "Check bot latency",
        category: "System"
    },

    run: async ({ api, event, args }: IRunParams) => {
        const timeStart = Date.now();

        api.sendMessage("Pong! 🏓 Measuring speed...", event.threadID, (err?: Error | null, info?: { threadID: string; messageID: string; timestamp: number } | null) => {
            if(err) return;
            const timeEnd = Date.now();
            api.sendMessage(`Ping: ${timeEnd - timeStart}ms`, event.threadID);
        });
    }
};

export = command;
