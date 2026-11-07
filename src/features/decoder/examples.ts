/** Hand-picked example sentences rich in connected speech (General American). */
export const DEFAULT_TEXT = "What do you want to do tonight? I'm going to check it out.";

/** Sample chips the decoder page shows while the input is empty (the others are reachable only by typing them). */
export const EXAMPLES_SHOWN = 3;

export const EXAMPLES: string[] = [
  DEFAULT_TEXT,
  'Did you get it? I told him to put it on the table.',
  "I'm going to pick it up at eight o'clock.",
  'Could I have a cup of coffee and a piece of cake?',
  'Turn it off and get out of here.',
  "I don't know what he wants, but I have to try.",
  'Would you like to come over next Saturday?',
  "Tell her I'll call her back in a minute.",
  "We should have asked him first. It's not a big deal.",
  "Where did you put my phone? I can't find it anywhere.",
  "I've got to go. I'll talk to you later.",
  'Let me know what you think about it.',
];

/**
 * Connected TTS text for each example (the main "Nghe" on the decoder page): reviewed eye dialect the engine says
 * the way the decoder shows it. Use speakableFor(text, EXAMPLE_SAY[text]); once the learner edits the text there is
 * no entry and the generated decode(text).speakText is used. "Đọc rõ từng từ" plays the written text.
 */
export const EXAMPLE_SAY: Readonly<Record<string, string>> = {
  [DEFAULT_TEXT]: "Whaddaya wanna do tonight? I'm gonna checkid out.",
  'Did you get it? I told him to put it on the table.': 'Didja geddit? I toldim to puddid on the table.',
  "I'm going to pick it up at eight o'clock.": "I'm gonna pickid up at eight o'clock.",
  'Could I have a cup of coffee and a piece of cake?': "Could I have a cuppa coffee an a piece of cake?",
  'Turn it off and get out of here.': "Turnid off an get outta here.",
  "I don't know what he wants, but I have to try.": 'I dunno what he wants, buddai hafta try.',
  'Would you like to come over next Saturday?': 'Would juh like to come over nex Saturday?',
  "Tell her I'll call her back in a minute.": "Teller I'll caller back in a minute.",
  "We should have asked him first. It's not a big deal.": "We shoulda asked him first. It's nodda big deal.",
  "Where did you put my phone? I can't find it anywhere.": "Wheredja put my phone? I can't findid anywhere.",
  "I've got to go. I'll talk to you later.": "I've gotta go. I'll talk to yuh later.",
  'Let me know what you think about it.': 'Lemme know whatcha think about it.',
};
