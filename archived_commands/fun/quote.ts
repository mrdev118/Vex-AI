import { ICommand, IRunParams } from '../../types';

const quotes = [
    "Live as if tomorrow is your last day!",
    "Success doesn't come to those who wait.",
    "Do what you love!",
    "Don't fear failure; fear not trying!",
    "Each day is a new chance to start over.",
    "Happiness is not a destination; it's a journey.",
    "Time is the most valuable asset.",
    "Believe in yourself!"
];

const command: ICommand = {
    config: {
        name: "quote",
        version: "1.0.0",
        author: "Donix",
        description: "Get a random inspirational quote",
        category: "Fun"
    },

    run: async ({ api, event }: IRunParams) => {
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        api.sendMessage(`"${randomQuote}"`, event.threadID);
    }
};

export = command;
