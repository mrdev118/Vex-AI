import { ICommand } from '../../types';
import { createMessageHelper } from '../../src/utils/message';

const DONATE_REGEX = /\bdonate\b/i;

const donateMessage = `𝗗𝗼𝗻𝗮𝘁𝗼𝗿 Perks:

[+] 𝗗𝗼𝗻𝗮𝘁𝗼𝗿
 - Donator Kits
  - $50,000 Money
   - 5 Enchanted Golden Apple
    - 3 Days Strength
     - Special 𝗗𝗼𝗻𝗮𝘁𝗼𝗿 tag
      - 5 Sethomes
       - Given to players who donated ₱50/$1 or more.

[+] 𝗗𝗼𝗻𝗮𝘁𝗼𝗿+
 - Donator+ Kits
  - $50,000 Money
   - 5 Enchanted Golden Apple
    - 4 Days Strength
     - 𝗗𝗼𝗻𝗮𝘁𝗼𝗿 tag
      - 1 Cosmetic Tag
       - 6 Sethomes
        - Given to players who donated ₱100/$2 or more.

[+] 𝗗𝗼𝗻𝗮𝘁𝗼𝗿++
 - Donator++ Kits
  - $100,000 Money
   - 5 Enchanted Golden Apple
    - 2 Totem of Undying
     - 5 Days Strenght 
      - 2 Days Invisibility
       - Cosmetic tag
        - 𝗗𝗼𝗻𝗮𝘁𝗼𝗿++ tag 
         - 𝗠𝗶𝗹𝗹𝗶𝗼𝗻𝗮𝗶𝗿𝗲 tag
          - 7 Sethomes
           - Given to players who donated ₱200/$4 or more.

DM THE STAFF IF YOU WANT TO DONATE

Note: 
All donations will be used exclusively to upgrade and improve the server, including better performance, features, and overall player experience. Your support helps keep the server running smoothly.`;

const command: ICommand = {
  config: {
    name: 'donate',
    description: 'Show donation perks when someone mentions donate',
    category: 'Fun',
    hasPrefix: false
  },

  // Trigger whenever "donate" appears in chat
  handleChat: async ({ api, event }) => {
    const body = (event.body || '').toLowerCase();
    if (!DONATE_REGEX.test(body)) return;

    const messageHelper = createMessageHelper(api, event);
    await messageHelper.send(donateMessage);
  }
};

export = command;
