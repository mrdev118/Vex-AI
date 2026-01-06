import os from 'os';
import { ICommand, IRunParams } from '../../types';

const startTime = Date.now();
let commandRunCount = 0;

const command: ICommand = {
  config: {
    name: "uptime",
    version: "1.0.0",
    author: "Donix",
    description: "View bot info (uptime, CPU, RAM, heap, ping)",
    category: "System"
  },

  run: async ({ api, event, name }: IRunParams) => {
    commandRunCount++;

    const uptime = Date.now() - startTime;
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const formatTime = (): string => {
      const parts: string[] = [];
      if (days > 0) parts.push(`${days} days`);
      if (hours % 24 > 0) parts.push(`${hours % 24} hours`);
      if (minutes % 60 > 0) parts.push(`${minutes % 60} minutes`);
      if (seconds % 60 > 0) parts.push(`${seconds % 60} seconds`);
      return parts.join(', ') || '0 seconds';
    };

    const cpus = os.cpus();
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + (1 - idle / total);
    }, 0) / cpus.length * 100;

    const memUsage = process.memoryUsage();
    const rss = (memUsage.rss / 1024 / 1024).toFixed(2);
    const heapUsed = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
    const heapTotal = (memUsage.heapTotal / 1024 / 1024).toFixed(2);

    const pingStart = Date.now();
    api.sendMessage("🏓 Measuring ping...", event.threadID, (err?: Error | null, info?: { threadID: string; messageID: string; timestamp: number } | null) => {
      if (err) return;
      const ping = Date.now() - pingStart;

      const message = `
⏱️ Uptime: ${formatTime()}
💻 CPU: ${cpuUsage.toFixed(1)}%
📊 RAM (RSS): ${rss} MB
🗄️ Heap: ${heapUsed} MB / ${heapTotal} MB
🏓 Ping: ${ping}ms
🎲 Ran: ${commandRunCount} times
            `.trim();

      api.sendMessage(message, event.threadID);
    });
  }
};

export = command;
