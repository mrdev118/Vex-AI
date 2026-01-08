import { ICommand, IRunParams } from '../../types';

const command: ICommand = {
    config: {
        name: "random",
        version: "1.0.0",
        author: "Donix",
        description: "Pick a random item from a list",
        category: "Fun",
        usages: "!random item1, item2, item3"
    },

    run: async ({ api, event, args }: IRunParams) => {
        if (args.length === 0) {
            api.sendMessage("Please provide a list! Example: !random A, B, C", event.threadID);
            return;
        }

        const input = args.join(' ');
        const items = input.split(',').map(item => item.trim()).filter(item => item.length > 0);

        if (items.length === 0) {
            api.sendMessage("❌ That list is not valid!", event.threadID);
            return;
        }

        const randomItem = items[Math.floor(Math.random() * items.length)];
        api.sendMessage(`🎲 Result: ${randomItem}`, event.threadID);
    }
};

export = command;
