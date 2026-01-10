import { ICommand, IRunParams } from '../../types';

const ENCHANTS_MESSAGE = `@everyone

⚔️ 𝗪𝗲𝗮𝗽𝗼𝗻 𝗘𝗻𝗰𝗵𝗮𝗻𝘁𝘀

𝗦𝗼𝘂𝗹 𝗙𝗶𝗿𝗲
• Slows mobs and ignites even fire-immune entities; higher levels increase duration.

𝗦𝘄𝗲𝗲𝗽𝗶𝗻𝗴 𝗘𝗱𝗴𝗲
• Deals area damage to nearby mobs, increased per level.

𝗠𝗲𝘁𝗲𝗼𝗿 𝗦𝗺𝗮𝘀𝗵
• Mace Smash attacks ignite nearby mobs.

𝗟𝗲𝗲𝗰𝗵𝗶𝗻𝗴
• Killing mobs heals you based on their max health, scaling per level.

𝗣𝗼𝗶𝘀𝗼𝗻 𝗣𝘂𝗳𝗳
• Applies poison on hit (2 levels).

⛏️ 𝗧𝗼𝗼𝗹 𝗘𝗻𝗰𝗵𝗮𝗻𝘁𝘀

𝗦𝗺𝗲𝗹𝘁𝗶𝗻𝗴
• Automatically smelts ores and sand, with more XP per level.

𝗗𝗲𝗲𝗽 𝗕𝗿𝗲𝗮𝗸𝗲𝗿
• Mines stone-type blocks in a 3×3 area.

🛡️ 𝗔𝗿𝗺𝗼𝗿 𝗘𝗻𝗰𝗵𝗮𝗻𝘁𝘀

𝗚𝗹𝗼𝘄𝗶𝗻𝗴 𝗔𝘂𝗿𝗮
• Emits light around the player, stronger per level.

𝗩𝗶𝘁𝗮𝗹𝗶𝘁𝘆
• Increases max health by 2 hearts per level (5 levels).

𝗥𝗲𝗰𝗸𝗹𝗲𝘀𝘀
• Reduces max health by 40% but grants Strength matching the level.

𝗕𝘂𝗿𝗻𝗶𝗻𝗴 𝗧𝗵𝗼𝗿𝗻𝘀
• Chance per level to set attackers on fire when hit.

𝗖𝗼𝘄𝗮𝗿𝗱𝗶𝗰𝗲
• Greatly increases speed while at full health.

𝗗𝗼𝘂𝗯𝗹𝗲 𝗝𝘂𝗺𝗽
• Allows a second jump with higher levels increasing height.

𝗟𝗮𝘃𝗮 𝗪𝗮𝗹𝗸𝗲𝗿
• Lets you walk on lava by creating temporary basalt.

🪽 𝗘𝗹𝘆𝘁𝗿𝗮 𝗘𝗻𝗰𝗵𝗮𝗻𝘁𝘀

𝗪𝗶𝗻𝗱 𝗖𝗵𝗮𝗿𝗴𝗲
• Boosts you when starting to glide.

𝗜𝗿𝗼𝗻 𝗪𝗶𝗻𝗴𝘀
• Grants Resistance while not flying.

🏹 𝗥𝗮𝗻𝗴𝗲𝗱 𝗘𝗻𝗰𝗵𝗮𝗻𝘁𝘀

𝗠𝘂𝗹𝘁𝗶 𝗔𝗿𝗿𝗼𝘄
• Fires two extra arrows similar to Multishot.

𝗕𝗼𝗼𝗺𝘀𝗵𝗼𝘁
• Fully charged arrows explode on impact.

𝗦𝗼𝗻𝗶𝗰 𝗖𝗵𝗮𝗿𝗴𝗲
• Fires a short-range sonic attack instead of arrows.

𝗙𝗶𝗿𝗲 𝗖𝗵𝗮𝗿𝗴𝗲
• Ignites fired arrows.

🛡️ 𝗦𝗵𝗶𝗲𝗹𝗱 𝗘𝗻𝗰𝗵𝗮𝗻𝘁𝘀

𝗕𝗼𝘂𝗻𝗰𝗲
• Increases shield knockback per level.

𝗦𝗽𝗶𝗸𝗲𝘀
• Damages melee attackers, scaling with level.`;

const command: ICommand = {
  config: {
    name: 'customenchants',
    aliases: ['ce'],
    description: 'List custom enchant effects',
    category: 'System',
    usages: '.ce'
  },

  run: async ({ send }: IRunParams) => {
    await send(ENCHANTS_MESSAGE);
  }
};

export = command;
