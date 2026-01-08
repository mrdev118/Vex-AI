import { ICommand, IRunParams } from '../../types';

const command: ICommand = {
  config: {
    name: "autosad",
    hasPrefix: false,
    description: "Automatically sends encouragement when sad keywords appear",
    category: "Fun",
  },

  run: async ({ api, event }: IRunParams) => {
    const body = event.body.toLowerCase();

    const sadKeywords = [
      // Vietnamese (kept for compatibility)
      'buồn',
      'chán',
      'khóc',
      'tủi thân',
      // English
      'sad',
      'depressed',
      'unhappy',
      'cry',
      'crying'
    ];
    const isSad = sadKeywords.some(word => body.includes(word));

    if (isSad) {
      api.sendMessage("Hey, I'm here for you. Take a deep breath - you've got this. ❤️", event.threadID);
    }
  }
};

export = command;
