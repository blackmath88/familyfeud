const FILLERS = [
  'ich würde sagen', 'ich wuerde sagen', 'ich glaube', 'vielleicht',
  'ähm', 'aehm', 'äh', 'hm', 'also', 'ja', 'so', 'halt',
];
const ARTICLES = new Set(['der', 'die', 'das', 'den', 'dem', 'ein', 'eine', 'einen', 'einem', 'einer']);

export function normalize(input: string, wakeWord = 'antwort'): string {
  let text = input.toLocaleLowerCase('de-CH').replace(/ß/g, 'ss');
  const wake = wakeWord.trim().toLocaleLowerCase('de-CH');
  if (wake) text = text.replace(new RegExp(`\\b${escapeRegex(wake)}(?:e| ist)?\\b`, 'gu'), ' ');
  text = text.replace(/[^a-z0-9äöü\s-]/gu, ' ').replace(/-/g, ' ');
  for (const filler of FILLERS) {
    text = text.replace(new RegExp(`(^|\\s)${escapeRegex(filler)}(?=\\s|$)`, 'gu'), ' ');
  }
  const tokens = text.trim().split(/\s+/u).filter(Boolean);
  while (tokens.length && ARTICLES.has(tokens[0])) tokens.shift();
  return tokens.join(' ').replace(/\s+/g, ' ').trim();
}

export function foldUmlauts(input: string): string {
  return input.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u');
}

export function lightStem(input: string): string {
  return input.split(' ').map((word) => word.replace(/(en|er|e|n|s)$/u, '') || word).join(' ');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
