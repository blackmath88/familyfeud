import type { AnswerRef, MatchResult } from './types';
import { koelnerPhonetik } from './koelner';
import { foldUmlauts, lightStem, normalize } from './normalize';

export const SURE = 0.85;
export const UNSURE = 0.6;

export function match(guess: string, answers: AnswerRef[], wakeWord = 'antwort'): MatchResult {
  const normalizedGuess = normalize(guess, wakeWord);
  let best = { rank: null as number | null, score: 0, via: null as MatchResult['via'], revealed: false };
  for (const answer of [...answers].sort((a, b) => a.rank - b.rank)) {
    for (const candidate of [answer.label, ...answer.aliases]) {
      const normalizedCandidate = normalize(candidate);
      const result = scoreCandidate(normalizedGuess, normalizedCandidate);
      if (result.score > best.score) {
        best = { rank: answer.rank, ...result, revealed: answer.revealed };
      }
    }
  }
  const kind = best.score >= SURE
    ? (best.revealed ? 'duplicate' : 'sure')
    : best.score >= UNSURE ? 'unsure' : 'miss';
  return {
    kind,
    rank: kind === 'miss' ? null : best.rank,
    score: best.score,
    via: best.via,
    normalizedGuess,
  };
}

function scoreCandidate(guess: string, candidate: string): { score: number; via: MatchResult['via'] } {
  if (!guess || !candidate) return { score: 0, via: null };
  if (guess === candidate) return { score: 1, via: 'exact' };
  const guessTokens = guess.split(' ');
  const candidateTokens = candidate.split(' ');
  const contained = candidateTokens.every((token) => token.length >= 4 && guessTokens.includes(token))
    || guessTokens.every((token) => token.length >= 4 && candidateTokens.includes(token));
  if (contained) return { score: 0.9, via: 'contains' };
  const candidateCode = koelnerPhonetik(candidate);
  const phonetic = candidateCode && (
    koelnerPhonetik(guess) === candidateCode
    || (candidateTokens.length === 1 && guessTokens.some((token) => koelnerPhonetik(token) === candidateCode))
  );
  if (phonetic) return { score: 0.85, via: 'phonetic' };
  const variants: [string, string][] = [
    [guess, candidate],
    [lightStem(foldUmlauts(guess)), lightStem(foldUmlauts(candidate))],
  ];
  const score = Math.max(...variants.map(([a, b]) => 1 - levenshtein(a, b) / Math.max(a.length, b.length)));
  return { score, via: score > 0 ? 'fuzzy' : null };
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length];
}
