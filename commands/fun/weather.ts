import { ICommand, IRunParams } from '../../types';

const command: ICommand = {
    config: {
        name: "weather",
        version: "1.0.0",
        author: "Donix",
        description: "View weather (mock)",
        category: "Utility",
        usages: "!weather <city>"
    },

    run: async ({ api, event, args }: IRunParams) => {
        const city = args.join(' ') || "Hanoi";

        const weather = {
            city: city,
            temp: Math.floor(Math.random() * 15) + 20,
            condition: ["☀️ Sunny", "☁️ Cloudy", "🌧️ Rainy", "⛅ Partly Cloudy"][Math.floor(Math.random() * 4)]
        };

        const message = `🌤️ Weather ${weather.city}:\n🌡️ Temperature: ${weather.temp}°C\n${weather.condition}`;
        api.sendMessage(message, event.threadID);
    }
};

export = command;
