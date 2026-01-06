import { unloadCommand } from '../../src/loader';
import { IRunParams } from '../../types';
import { ICommand } from '../../types';

const command: ICommand = {
  config: {
    name: "unload",
    version: "1.0.0",
    author: "Donix",
    description: "Unload command from memory",
    category: "System",
    usages: "!unload <command name>",
    aliases: ["remove"],
    role: 2 // Bot Admin
  },

  run: async ({ api, event, args, send }: IRunParams) => {

    if (args.length === 0) {
      await send(
        "Please enter the command name to unload!\n" +
        "• !unload <command name> - Unload 1 command\n" +
        "Example: !unload ping"
      );
      return;
    }

    const commandName = args[0].toLowerCase();
    const result = unloadCommand(commandName);
    await send(result.message);
  }
};

export = command;
