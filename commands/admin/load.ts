import { loadSingleCommand, loadMultipleCommands, loadCommands } from '../../src/loader';
import { client } from '../../src/client';
import { IRunParams } from '../../types';
import { ICommand } from '../../types';

const command: ICommand = {
  config: {
    name: "load",
    version: "1.0.0",
    author: "Donix",
    description: "Reload command (by name or all)",
    category: "System",
    usages: "!load <command name> or !load all",
    role: 2 // Bot Admin
  },

  run: async ({ api, event, args, send }: IRunParams) => {

    if (args.length === 0) {
      await send(
        "Please enter the command name to reload!\n" +
        "• !load <command name> - Reload 1 command\n" +
        "• !load <name1> <name2> ... - Reload multiple commands\n" +
        "• !load all - Reload all commands\n" +
        "Example: !load ping or !load ping help or !load all"
      );
      return;
    }

    const target = args[0].toLowerCase();

    if (target === "all") {
      client.commands.clear();
      client.noprefix.clear();
      loadCommands();
      await send("✅ Reloaded all commands");
    } else if (args.length === 1) {
      const result = loadSingleCommand(target);
      await send(result.message);
    } else {
      const commandNames = args.map(arg => arg.toLowerCase());
      const result = loadMultipleCommands(commandNames);
      await send(result.message);
    }
  }
};

export = command;
