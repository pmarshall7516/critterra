export interface DialogueScript {
  id: string;
  speaker: string;
  lines: string[];
  setFlag?: string;
}

export const DIALOGUES: Record<string, DialogueScript> = {
  brother_intro: {
    id: 'brother_intro',
    speaker: 'Eli',
    lines: [
      'Hey, you\'re finally awake.',
      'Aunt Mara is handing out starter Critters at Kira\'s house.',
      'Head there before everyone else claims the best pick.',
    ],
    setFlag: 'talked_to_brother',
  },
  town_friend_intro: {
    id: 'town_friend_intro',
    speaker: 'Niko',
    lines: [
      'Perfect timing.',
      'Kira has been bragging all morning about getting first choice.',
      'Grab your starter, then we\'ll race to Route 1.',
    ],
  },
  town_gardener_intro: {
    id: 'town_gardener_intro',
    speaker: 'Iris',
    lines: [
      'Every trainer in Willowbrook starts right here on this road.',
      'Once you pick your partner, the whole region opens up.',
    ],
  },
  rival_parent_intro: {
    id: 'rival_parent_intro',
    speaker: 'Aunt Mara',
    lines: [
      'There you are, sweetheart.',
      'Kira and I saved three starter Critters for today.',
      'Check the basket on the table and choose the one that feels right.',
    ],
    setFlag: 'met_rival_parent',
  },
  rival_intro: {
    id: 'rival_intro',
    speaker: 'Kira',
    lines: [
      'Took you long enough.',
      'I was about to pick yours for you.',
      'Grab your Critter and meet me on the north road.',
    ],
  },
};
