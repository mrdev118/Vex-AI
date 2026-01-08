import { ICommand, IRunParams } from '../../types';

const command: ICommand = {
  config: {
    name: "calc",
    version: "1.0.0",
    author: "Donix",
    description: "Simple calculator",
    category: "Utility",
    usages: "!calc <expression>"
  },

  run: async ({ api, event, args }: IRunParams) => {
    if (args.length === 0) {
      api.sendMessage("Please provide an expression! Example: !calc 2+2", event.threadID);
      return;
    }

    const expression = args.join(' ');

    try {
      if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
        api.sendMessage("❌ Invalid expression! Only numbers and basic operators are allowed.", event.threadID);
        return;
      }

      const result = Function(`"use strict"; return (${expression})`)();

      api.sendMessage(`🧮 ${expression} = ${result}`, event.threadID);
    } catch (error) {
      api.sendMessage("❌ Could not evaluate that expression!", event.threadID);
    }
  }
};

export = command;
