import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../src/utils/logger';
import { ICommand, IRunParams } from '../../types';

const execAsync = promisify(exec);

const command: ICommand = {
  config: {
    name: "shell",
    version: "1.0.0",
    author: "Donix",
    description: "Run shell/terminal command (owner only)",
    category: "Admin",
    usages: "!shell <command>",
    aliases: ["sh", "cmd", "terminal"],
    role: 3 // Owner
  },

  run: async ({ api, event, args, send, reply, react, Users, Threads, config: cmdConfig }: IRunParams) => {
    const { threadID, messageID } = event;

    try {
      const commandStr = args.join(' ');
      if (!commandStr) {
        await send('⚠️ Please enter shell command to execute.\n📝 Example: !shell dir or !shell ls -la');
        return;
      }

      await react('⏳');

      const { stdout, stderr } = await execAsync(commandStr, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 60000,
      });

      await react('✅');

      let output = '';

      if (stdout) {
        output += `📤 STDOUT:\n${stdout}\n\n`;
      }

      if (stderr && stderr.trim()) {
        output += `⚠️ STDERR:\n${stderr}\n\n`;
      }

      if (!output.trim()) {
        await send('✅ Command executed successfully (no output).');
        return;
      }

      if (output.length > 2000) {
        const truncated = output.substring(0, 1950);
        await send(`${truncated}\n\n... (truncated, total ${output.length} characters)`);
      } else {
        await send(output.trim());
      }

    } catch (e: any) {
      await react('❌');

      let errorMessage = '';

      if (e.code === 'ENOENT') {
        errorMessage = `❌ Error: Command not found "${args[0]}"\n📝 Command does not exist or is not in PATH.`;
      } else if (e.code === 'ETIMEDOUT' || e.message?.includes('timeout')) {
        errorMessage = `⏱️ Error: Command timed out (60 seconds).`;
      } else if (e.stderr) {
        errorMessage = `❌ STDERR:\n${e.stderr}`;
      } else {
        errorMessage = `❌ Error: ${e.message || 'Unknown error.'}`;
      }

      if (errorMessage.length > 2000) {
        const truncated = errorMessage.substring(0, 1950);
        await send(`${truncated}\n\n... (truncated)`);
      } else {
        await send(errorMessage);
      }

      logger.error('Shell command error:', e);
    }
  }
};

export = command;
