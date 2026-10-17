import { describe, expect, it } from 'vitest';
import type { JudgeRequest, QuestionInput } from '../game/types';
import { judgeGuess } from './judge';
import { app, validateQuestion } from './index';

const valid: QuestionInput = {
  packId: 'beispiel', text: 'Testfrage?', surveySize: 100, difficulty: 1, status: 'approved',
  answers: [
    { rank: 1, label: 'Eins', points: 40, aliases: ['erste'] },
    { rank: 2, label: 'Zwei', points: 25, aliases: ['zweite'] },
    { rank: 3, label: 'Drei', points: 20, aliases: ['dritte'] },
    { rank: 4, label: 'Vier', points: 10, aliases: ['vierte'] },
  ],
};

describe('worker validation', () => {
  it('accepts valid content and rejects structural errors in German', () => {
    expect(validateQuestion(valid)).toBeNull();
    expect(validateQuestion({ ...valid, answers: valid.answers.slice(0, 3) })).toContain('4 bis 8');
    expect(validateQuestion({ ...valid, answers: valid.answers.map((answer, index) => index === 1 ? { ...answer, rank: 4 } : answer) })).toContain('Ränge');
    expect(validateQuestion({ ...valid, answers: valid.answers.map((answer, index) => index === 0 ? { ...answer, aliases: ['Gross'] } : answer) })).toContain('kleingeschrieben');
    expect(validateQuestion({ ...valid, answers: valid.answers.map((answer, index) => index === 0 ? { ...answer, aliases: null } : answer) } as unknown as QuestionInput)).toContain('Aliase');
  });
});

describe('worker routing', () => {
  it('returns a JSON 404 for unknown API routes without invoking assets', async () => {
    let assetRequests = 0;
    const response = await app.request('/api/does-not-exist', {}, {
      ASSETS: { fetch: async () => { assetRequests += 1; return new Response('html'); } },
    } as unknown as Parameters<typeof app.request>[2]);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Nicht gefunden.' });
    expect(assetRequests).toBe(0);
  });
});

describe('judge fallback', () => {
  const request: JudgeRequest = {
    question: 'Was zieht man zum Schlafen an?', guess: 'Nachthemd anziehen',
    answers: [{ rank: 1, label: 'Schlafanzug an', aliases: ['pyjama'] }],
  };

  it('matches deterministically in mock mode', async () => {
    await expect(judgeGuess(request, { MOCK_JUDGE: '1' })).resolves.toMatchObject({ rank: 1, confidence: 0.95 });
  });

  it('returns judge_unavailable immediately without a key', async () => {
    await expect(judgeGuess(request, {})).resolves.toEqual({ rank: null, confidence: 0, reason: 'judge_unavailable' });
  });
});
