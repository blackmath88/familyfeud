import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameConfig, JudgeRequest, QuestionInput } from '../game/types';
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

const validGame: GameConfig = {
  title: 'FAMILIEN-QUIZ', teams: [{ name: 'A', players: ['Anna'] }, { name: 'B', players: ['Beat'] }],
  rounds: 3, multipliers: [1, 1, 3], packIds: ['beispiel'], allowRepeats: false, hostSeesAnswers: false,
  voice: { enabled: false, lang: 'de-CH', wakeWord: 'antwort' }, llm: { enabled: false, autoAcceptAt: null },
};

describe('worker validation', () => {
  it('accepts valid content and rejects structural errors in German', () => {
    expect(validateQuestion(valid)).toBeNull();
    expect(validateQuestion(null)).toContain('Paket und Fragetext');
    expect(validateQuestion({ ...valid, answers: valid.answers.slice(0, 3) })).toContain('4 bis 8');
    expect(validateQuestion({ ...valid, answers: valid.answers.map((answer, index) => index === 1 ? { ...answer, rank: 4 } : answer) })).toContain('Ränge');
    expect(validateQuestion({ ...valid, answers: valid.answers.map((answer, index) => index === 0 ? { ...answer, aliases: ['Gross'] } : answer) })).toContain('kleingeschrieben');
    expect(validateQuestion({ ...valid, answers: valid.answers.map((answer, index) => index === 0 ? { ...answer, aliases: [''] } : answer) })).toContain('Aliase');
    expect(validateQuestion({ ...valid, answers: valid.answers.map((answer, index) => index === 0 ? { ...answer, aliases: null } : answer) } as unknown as QuestionInput)).toContain('Aliase');
  });
});

describe('worker routing', () => {
  it('rejects malformed question counts before touching D1', async () => {
    for (const count of ['abc', '1.5']) {
      const response = await app.request(`/api/questions?count=${count}`, {}, {} as Parameters<typeof app.request>[2]);
      expect(response.status).toBe(400);
    }
  });

  it('returns a JSON 404 for unknown API routes without invoking assets', async () => {
    let assetRequests = 0;
    const response = await app.request('/api/does-not-exist', {}, {
      ASSETS: { fetch: async () => { assetRequests += 1; return new Response('html'); } },
    } as unknown as Parameters<typeof app.request>[2]);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Nicht gefunden.' });
    expect(assetRequests).toBe(0);
  });

  it('exports a large pack with a constant three-query budget', async () => {
    let prepareCalls = 0;
    const rows = Array.from({ length: 60 }, (_, index) => ({
      id: `q-${index}`, pack_id: 'large', text: `Frage ${index}?`, survey_size: 100,
      difficulty: 1, status: 'approved',
    }));
    const db = {
      prepare: (sql: string) => {
        prepareCalls += 1;
        return { bind: () => ({
          first: async () => ({ id: 'large', name: 'Gross', source: 'manual' }),
          all: async () => ({ results: sql.includes('FROM answers') ? [] : rows }),
        }) };
      },
    };
    const response = await app.request('/api/packs/large/export', {}, { DB: db } as unknown as Parameters<typeof app.request>[2]);
    expect(response.status).toBe(200);
    expect(prepareCalls).toBe(3);
    expect((await response.json() as { questions: unknown[] }).questions).toHaveLength(60);
  });

  it('rejects an unsupported imported pack source before touching D1', async () => {
    const response = await app.request('/api/packs/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pack: { id: 'bad', name: 'Bad', source: 'external' }, questions: [] }),
    }, {} as Parameters<typeof app.request>[2]);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Ungültiges Paket.' });
    const badSlug = await app.request('/api/packs/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pack: { id: 'bad,pack', name: 'Bad', source: 'manual' }, questions: [] }),
    }, {} as Parameters<typeof app.request>[2]);
    expect(badSlug.status).toBe(400);
  });

  it('rejects an imported question ID owned by another pack before writing', async () => {
    let mutations = 0;
    const db = {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: [{ id: 'shared', pack_id: 'other-pack' }] }),
          run: async () => { mutations += 1; },
        }),
      }),
      batch: async () => { mutations += 1; },
    };
    const response = await app.request('/api/packs/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pack: { id: 'beispiel', name: 'Beispiel', source: 'manual' }, questions: [{ ...valid, id: 'shared' }] }),
    }, { DB: db } as unknown as Parameters<typeof app.request>[2]);
    expect(response.status).toBe(409);
    expect(mutations).toBe(0);
  });

  it('writes a complete pack import in one atomic batch', async () => {
    let batchCalls = 0;
    let statementCount = 0;
    let prepareCalls = 0;
    const db = {
      prepare: () => {
        prepareCalls += 1;
        return { bind: () => ({ all: async () => ({ results: [] }) }) };
      },
      batch: async (statements: unknown[]) => { batchCalls += 1; statementCount = statements.length; },
    };
    const response = await app.request('/api/packs/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pack: { id: 'beispiel', name: 'Beispiel', source: 'manual' }, questions: [{ ...valid, id: 'new-question' }] }),
    }, { DB: db } as unknown as Parameters<typeof app.request>[2]);
    expect(response.status).toBe(200);
    expect(batchCalls).toBe(1);
    expect(statementCount).toBe(4);
    expect(prepareCalls).toBe(5);
  });

  it('rejects changing a question to another pack as a controlled conflict', async () => {
    let batchCalls = 0;
    const db = {
      prepare: () => ({ bind: () => ({ first: async () => ({ id: 'question', pack_id: 'original' }) }) }),
      batch: async () => { batchCalls += 1; },
    };
    const response = await app.request('/api/questions/question', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...valid, packId: 'different' }),
    }, { DB: db } as unknown as Parameters<typeof app.request>[2]);
    expect(response.status).toBe(409);
    expect(batchCalls).toBe(0);
  });

  it('rejects incomplete or mismatched game configurations before touching D1', async () => {
    for (const body of [{ config: {}, questionIds: ['1'] }, { config: validGame, questionIds: ['1', '2'] }]) {
      const response = await app.request('/api/games', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      }, {} as Parameters<typeof app.request>[2]);
      expect(response.status).toBe(400);
    }
  });

  it('rejects game questions that are not approved members of a selected pack', async () => {
    let batchCalls = 0;
    let eligibilitySql = '';
    const db = {
      prepare: (sql: string) => {
        eligibilitySql = sql;
        return { bind: () => ({ all: async () => ({ results: [{ id: '1' }, { id: '2' }] }) }) };
      },
      batch: async () => { batchCalls += 1; },
    };
    const response = await app.request('/api/games', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config: validGame, questionIds: ['1', '2', 'draft-or-wrong-pack'] }),
    }, { DB: db } as unknown as Parameters<typeof app.request>[2]);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Mindestens eine Frage ist nicht spielbar.' });
    expect(batchCalls).toBe(0);
    expect(eligibilitySql).toContain('times_played = 0');
  });

  it.each(['/api/questions', '/api/packs/import', '/api/games'])('rejects a null body on %s without touching D1', async (path) => {
    const response = await app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'null',
    }, {} as Parameters<typeof app.request>[2]);
    expect(response.status).toBe(400);
  });

  it.each([
    ['PUT', '/api/games/game-id'],
    ['POST', '/api/judge'],
  ])('rejects a null body on %s %s without touching dependencies', async (method, path) => {
    const response = await app.request(path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: 'null',
    }, {} as Parameters<typeof app.request>[2]);
    expect(response.status).toBe(400);
  });

  it('returns a client error for malformed JSON', async () => {
    const response = await app.request('/api/questions', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
    }, {} as Parameters<typeof app.request>[2]);
    expect(response.status).toBe(400);
  });
});

describe('judge fallback', () => {
  afterEach(() => vi.unstubAllGlobals());

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

  it('rejects a model rank that was not offered', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ rank: 99, confidence: 0.99, reason: 'invalid' }) } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })));
    await expect(judgeGuess(request, { MISTRAL_API_KEY: 'test' })).resolves.toEqual({ rank: null, confidence: 0, reason: 'judge_unavailable' });
  });
});
