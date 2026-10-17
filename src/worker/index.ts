import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import type { GameConfig, JudgeRequest, PackFile, Question, QuestionInput } from '../game/types';
import { judgeGuess } from './judge';

type Bindings = {
  DB: D1Database;
  ASSETS?: Fetcher;
  MISTRAL_API_KEY?: string;
  MOCK_JUDGE?: string;
};

export const app = new Hono<{ Bindings: Bindings }>();

app.get('/api/health', (context) => context.json({ ok: true }));

app.get('/api/packs', async (context) => {
  const result = await context.env.DB.prepare(`
    SELECT p.id, p.name, p.source, COUNT(q.id) AS question_count
    FROM packs p LEFT JOIN questions q ON q.pack_id = p.id AND q.status = 'approved'
    GROUP BY p.id ORDER BY p.name
  `).all<{ id: string; name: string; source: 'manual' | 'protoqa' | 'survey'; question_count: number }>();
  return context.json(result.results.map((row) => ({ id: row.id, name: row.name, source: row.source, questionCount: row.question_count })));
});

app.get('/api/questions', async (context) => {
  const packs = (context.req.query('packs') ?? '').split(',').filter(Boolean);
  const requestedCount = Number(context.req.query('count') ?? 5);
  if (!Number.isFinite(requestedCount) || !Number.isInteger(requestedCount) || requestedCount < 1) {
    return context.json({ error: 'Die Anzahl muss eine positive ganze Zahl sein.' }, 400);
  }
  const count = Math.min(10, requestedCount);
  const excludePlayed = context.req.query('excludePlayed') === '1';
  const where: string[] = ["q.status = 'approved'"];
  const values: unknown[] = [];
  if (packs.length) {
    where.push(`q.pack_id IN (${packs.map(() => '?').join(',')})`);
    values.push(...packs);
  }
  if (excludePlayed) where.push('q.times_played = 0');
  const rows = await context.env.DB.prepare(`SELECT q.* FROM questions q WHERE ${where.join(' AND ')} ORDER BY RANDOM() LIMIT ?`)
    .bind(...values, count).all<QuestionRow>();
  return context.json(await hydrateQuestions(context.env.DB, rows.results));
});

app.get('/api/questions/:id', async (context) => {
  const row = await context.env.DB.prepare('SELECT * FROM questions WHERE id = ?').bind(context.req.param('id')).first<QuestionRow>();
  if (!row) return context.json({ error: 'Frage nicht gefunden.' }, 404);
  return context.json((await hydrateQuestions(context.env.DB, [row]))[0]);
});

app.post('/api/questions', async (context) => {
  const input = await context.req.json<unknown>().catch(() => null);
  const error = validateQuestion(input);
  if (error) return context.json({ error }, 400);
  const question = input as QuestionInput;
  const id = question.id || nanoid();
  await writeQuestion(context.env.DB, id, question, false);
  return context.json({ ...question, id }, 201);
});

app.put('/api/questions/:id', async (context) => {
  const input = await context.req.json<unknown>().catch(() => null);
  const error = validateQuestion(input);
  if (error) return context.json({ error }, 400);
  const question = input as QuestionInput;
  const id = context.req.param('id');
  const exists = await context.env.DB.prepare('SELECT id FROM questions WHERE id = ?').bind(id).first();
  if (!exists) return context.json({ error: 'Frage nicht gefunden.' }, 404);
  await writeQuestion(context.env.DB, id, question, true);
  return context.json({ ...question, id });
});

app.delete('/api/questions/:id', async (context) => {
  await context.env.DB.prepare('DELETE FROM questions WHERE id = ?').bind(context.req.param('id')).run();
  return context.json({ ok: true });
});

app.get('/api/packs/:id/export', async (context) => {
  const pack = await context.env.DB.prepare('SELECT id, name, source FROM packs WHERE id = ?').bind(context.req.param('id')).first<PackFile['pack']>();
  if (!pack) return context.json({ error: 'Paket nicht gefunden.' }, 404);
  const rows = await context.env.DB.prepare('SELECT * FROM questions WHERE pack_id = ? ORDER BY id').bind(pack.id).all<QuestionRow>();
  return context.json({ pack, questions: await hydrateQuestions(context.env.DB, rows.results) } satisfies PackFile);
});

app.post('/api/packs/import', async (context) => {
  const input = await context.req.json<unknown>().catch(() => null);
  if (!isRecord(input) || !isRecord(input.pack) || typeof input.pack.id !== 'string' || !input.pack.id || typeof input.pack.name !== 'string' || !input.pack.name
    || typeof input.pack.source !== 'string' || !['manual', 'protoqa', 'survey'].includes(input.pack.source) || !Array.isArray(input.questions)) {
    return context.json({ error: 'Ungültiges Paket.' }, 400);
  }
  const file = input as unknown as PackFile;
  for (const question of file.questions) {
    const error = validateQuestion({ ...question, packId: file.pack.id });
    if (error) return context.json({ error }, 400);
  }
  await context.env.DB.prepare('INSERT INTO packs (id, name, source) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, source = excluded.source')
    .bind(file.pack.id, file.pack.name, file.pack.source).run();
  for (const question of file.questions) {
    const id = question.id || nanoid();
    const exists = await context.env.DB.prepare('SELECT id FROM questions WHERE id = ?').bind(id).first();
    await writeQuestion(context.env.DB, id, { ...question, packId: file.pack.id }, Boolean(exists));
  }
  return context.json({ ok: true, count: file.questions.length });
});

app.post('/api/games', async (context) => {
  const input = await context.req.json<unknown>().catch(() => null);
  if (!isRecord(input) || !isRecord(input.config) || !Array.isArray(input.questionIds) || input.questionIds.length < 1
    || !input.questionIds.every((id) => typeof id === 'string' && id)) return context.json({ error: 'Spielkonfiguration unvollständig.' }, 400);
  const body = input as unknown as { config: GameConfig; questionIds: string[] };
  const id = nanoid();
  const statements = [
    context.env.DB.prepare('INSERT INTO games (id, config) VALUES (?, ?)').bind(id, JSON.stringify(body.config)),
    ...body.questionIds.map((questionId, index) => context.env.DB.prepare('INSERT INTO game_questions (game_id, round_index, question_id) VALUES (?, ?, ?)').bind(id, index, questionId)),
    ...body.questionIds.map((questionId) => context.env.DB.prepare("UPDATE questions SET times_played = times_played + 1, last_played_at = datetime('now') WHERE id = ?").bind(questionId)),
  ];
  await context.env.DB.batch(statements);
  return context.json({ id }, 201);
});

app.put('/api/games/:id', async (context) => {
  const input = await context.req.json<unknown>().catch(() => null);
  if (!isRecord(input) || !isRecord(input.state)) return context.json({ error: 'Spielstand unvollständig.' }, 400);
  const { state } = input;
  await context.env.DB.prepare("UPDATE games SET state = ?, finished_at = CASE WHEN json_extract(?, '$.phase') = 'gameOver' THEN datetime('now') ELSE NULL END WHERE id = ?")
    .bind(JSON.stringify(state), JSON.stringify(state), context.req.param('id')).run();
  return context.json({ ok: true });
});

app.post('/api/judge', async (context) => {
  const input = await context.req.json<unknown>().catch(() => null);
  if (!isJudgeRequest(input)) return context.json({ error: 'Prüfanfrage unvollständig.' }, 400);
  return context.json(await judgeGuess(input, context.env));
});

app.notFound((context) => {
  if (context.req.path.startsWith('/api/')) return context.json({ error: 'Nicht gefunden.' }, 404);
  return context.env.ASSETS
    ? context.env.ASSETS.fetch(context.req.raw)
    : context.json({ error: 'Nicht gefunden.' }, 404);
});
app.onError((error, context) => {
  console.error(error);
  return context.json({ error: 'Interner Fehler.' }, 500);
});

interface QuestionRow {
  id: string;
  pack_id: string;
  text: string;
  survey_size: number;
  difficulty: 1 | 2 | 3;
  status: 'draft' | 'approved';
}

async function hydrateQuestions(db: D1Database, rows: QuestionRow[]): Promise<Question[]> {
  return Promise.all(rows.map(async (row) => {
    const answers = await db.prepare('SELECT rank, label, points, aliases FROM answers WHERE question_id = ? ORDER BY rank').bind(row.id)
      .all<{ rank: number; label: string; points: number; aliases: string }>();
    return {
      id: row.id, packId: row.pack_id, text: row.text, surveySize: row.survey_size,
      difficulty: row.difficulty, status: row.status,
      answers: answers.results.map((answer) => ({ ...answer, aliases: JSON.parse(answer.aliases) as string[] })),
    };
  }));
}

export function validateQuestion(input: unknown): string | null {
  if (!isRecord(input)) return 'Paket und Fragetext sind erforderlich.';
  const question = input as Partial<QuestionInput>;
  if (question.id !== undefined && (typeof question.id !== 'string' || !question.id.trim())) return 'Die Fragen-ID muss Text sein.';
  if (typeof question.packId !== 'string' || !question.packId.trim() || typeof question.text !== 'string' || !question.text.trim()) return 'Paket und Fragetext sind erforderlich.';
  if (typeof question.surveySize !== 'number' || !Number.isInteger(question.surveySize) || question.surveySize <= 0) return 'Die Umfragegrösse muss positiv sein.';
  if (typeof question.difficulty !== 'number' || ![1, 2, 3].includes(question.difficulty)) return 'Die Schwierigkeit muss 1, 2 oder 3 sein.';
  if (typeof question.status !== 'string' || !['draft', 'approved'].includes(question.status)) return 'Der Status ist ungültig.';
  if (!Array.isArray(question.answers) || question.answers.length < 4 || question.answers.length > 8) return 'Eine Frage braucht 4 bis 8 Antworten.';
  let sum = 0;
  let previousPoints = Number.POSITIVE_INFINITY;
  for (let index = 0; index < question.answers.length; index += 1) {
    const answer = question.answers[index];
    if (!isRecord(answer)) return 'Alle Antworten müssen gültige Objekte sein.';
    if (answer.rank !== index + 1) return 'Die Ränge müssen lückenlos bei 1 beginnen.';
    if (typeof answer.label !== 'string' || !answer.label.trim() || answer.label.length > 18) return 'Antworten müssen 1 bis 18 Zeichen lang sein.';
    const points = answer.points;
    if (typeof points !== 'number' || !Number.isInteger(points) || points < 0) return 'Punkte müssen positive ganze Zahlen sein.';
    if (points > previousPoints) return 'Punkte müssen absteigend sortiert sein.';
    if (!Array.isArray(answer.aliases) || !answer.aliases.every((alias) => typeof alias === 'string' && alias.trim().length > 0
      && alias === alias.trim() && alias === alias.toLocaleLowerCase('de-CH'))) return 'Aliase müssen eine Liste kleingeschriebener Texte sein.';
    previousPoints = points;
    sum += points;
  }
  if (sum > question.surveySize) return 'Die Punktesumme darf die Umfragegrösse nicht überschreiten.';
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJudgeRequest(value: unknown): value is JudgeRequest {
  return isRecord(value) && typeof value.question === 'string' && typeof value.guess === 'string' && Array.isArray(value.answers)
    && value.answers.every((answer) => isRecord(answer) && Number.isInteger(answer.rank) && typeof answer.label === 'string'
      && Array.isArray(answer.aliases) && answer.aliases.every((alias) => typeof alias === 'string'));
}

async function writeQuestion(db: D1Database, id: string, input: QuestionInput, update: boolean): Promise<void> {
  const questionStatement = update
    ? db.prepare("UPDATE questions SET pack_id = ?, text = ?, survey_size = ?, difficulty = ?, status = ?, updated_at = datetime('now') WHERE id = ?").bind(input.packId, input.text, input.surveySize, input.difficulty, input.status, id)
    : db.prepare('INSERT INTO questions (id, pack_id, text, survey_size, difficulty, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, input.packId, input.text, input.surveySize, input.difficulty, input.status);
  const statements = [questionStatement];
  if (update) statements.push(db.prepare('DELETE FROM answers WHERE question_id = ?').bind(id));
  statements.push(...input.answers.map((answer) => db.prepare('INSERT INTO answers (question_id, rank, label, points, aliases) VALUES (?, ?, ?, ?, ?)')
    .bind(id, answer.rank, answer.label, answer.points, JSON.stringify(answer.aliases))));
  await db.batch(statements);
}

export default app;
