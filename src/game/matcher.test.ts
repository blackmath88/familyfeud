import { describe, expect, it } from 'vitest';
import { koelnerPhonetik } from './koelner';
import { match } from './matcher';
import { normalize } from './normalize';

const answers = [
  { rank: 1, label: 'Zähne putzen', aliases: ['zahnbürste', 'zähneputzen'], revealed: false },
  { rank: 2, label: 'Hände', aliases: ['hand'], revealed: false },
  { rank: 3, label: 'Schlafanzug an', aliases: ['pyjama', 'pyjama anziehen'], revealed: false },
  { rank: 4, label: 'Bier', aliases: [], revealed: false },
];

describe('normalization and phonetics', () => {
  it('removes wake words, fillers, articles and punctuation', () => {
    expect(normalize('Antwort, ähm ich glaube die Zähne putzen!')).toBe('zähne putzen');
  });

  it('matches documented Kölner reference codes', () => {
    expect(koelnerPhonetik('Müller-Lüdenscheidt')).toBe('65752682');
    expect(koelnerPhonetik('Wikipedia')).toBe('3412');
    expect(koelnerPhonetik('Hende')).toBe(koelnerPhonetik('Hände'));
    expect(koelnerPhonetik('Hände')).toBe('062');
  });
});

describe('matcher pipeline', () => {
  it.each([
    ['Hende', 2, 'phonetic'],
    ['die Zähne putzen', 1, 'exact'],
    ['zahnbürste', 1, 'exact'],
    ['Pyjama', 3, 'exact'],
    ['ähm ich glaube Bier', 4, 'exact'],
  ] as const)('matches %s', (guess, rank, via) => {
    expect(match(guess, answers)).toMatchObject({ kind: 'sure', rank, via });
  });

  it('finds a close typo and rejects a clear miss', () => {
    expect(match('Schlafanzuk', answers)).toMatchObject({ rank: 3 });
    expect(match('Mondrakete', answers)).toMatchObject({ kind: 'miss', rank: null });
  });

  it('marks a revealed answer as duplicate', () => {
    const revealed = answers.map((answer) => answer.rank === 4 ? { ...answer, revealed: true } : answer);
    expect(match('Bier', revealed)).toMatchObject({ kind: 'duplicate', rank: 4 });
  });
});
