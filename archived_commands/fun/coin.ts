import { ICommand, IRunParams } from '../../types';

const command: ICommand = {
    config: {
        name: "coin",
        version: "1.0.0",
        author: "Donix",
        description: "Flip a coin",
        category: "Fun"
    },

    run: async ({ api, event }: IRunParams) => {
        const result = Math.random() < 0.5 ? "Heads" : "Tails";
        const emoji = "🪙";
        api.sendMessage(`${emoji} Result: ${result}`, event.threadID);
    }
};

export = command;
