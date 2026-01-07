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

        api.sendMessage("🏓 Pong! Measuring latency...", event.threadID, (err?: Error | null, info?: { threadID: string; messageID: string; timestamp: number } | null) => {
            if(err) return;
            const timeEnd = Date.now();
            const ping = timeEnd - timeStart;
            
            let status = "🟢 Excellent";
            if (ping > 500) status = "🔴 Poor";
            else if (ping > 200) status = "🟡 Fair";
            else if (ping > 100) status = "🟢 Good";
            
            const msg = `╔═══════════════════════════╗\n║     🏓 PING RESPONSE      ║\n╚═══════════════════════════╝\n\n⚡ Latency: ${ping}ms\n📊 Status: ${status}\n🤖 Bot: Online`;
            api.sendMessage(msg, event.threadID);
        });
    }
};

export = command;
