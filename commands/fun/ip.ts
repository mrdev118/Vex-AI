import { ICommand, IRunParams } from '../../types';

const command: ICommand = {
  config: {
    name: "ip",
    description: "Send server IP",
    category: "Fun",
    hasPrefix: false
  },

  run: async ({ api, event, send }: IRunParams) => {
    await send("Server IP: 123.123.123.123");
  }
};

export = command;
