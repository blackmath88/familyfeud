import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import type { GameConfig, PackFile, Question, QuestionInput } from '../game/types';
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
  const count = Math.max(1, Math.min(10, Number(context.req.query('count') ?? 5)));
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
  const input = await context.req.json<QuestionInput>();
  const error = validateQuestion(input);
  if (error) return context.json({ error }, 400);
  const id = input.id || nanoid();
  await writeQuestion(context.env.DB, id, input, false);
  return context.json({ ...input, id }, 201);
});

app.put('/api/questions/:id', async (context) => {
  const input = await context.req.json<QuestionInput>();
  const error = validateQuestion(input);
  if (error) return context.json({ error }, 400);
  const id = context.req.param('id');
  const exists = await context.env.DB.prepare('SELECT id FROM questions WHERE id = ?').bind(id).first();
  if (!exists) return context.json({ error: 'Frage nicht gefunden.' }, 404);
  await writeQuestion(context.env.DB, id, input, true);
  return context.json({ ...input, id });
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
  const file = await context.req.json<PackFile>();
  if (!file.pack?.id || !file.pack.name || !Array.isArray(file.questions)) return context.json({ error: 'Ungültiges Paket.' }, 400);
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
  const body = await context.req.json<{ config: GameConfig; questionIds: string[] }>();
  if (!body.config || !Array.isArray(body.questionIds) || body.questionIds.length < 1) return context.json({ error: 'Spielkonfiguration unvollständig.' }, 400);
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
  const { state } = await context.req.json<{ state: unknown }>();
  await context.env.DB.prepare("UPDATE games SET state = ?, finished_at = CASE WHEN json_extract(?, '$.phase') = 'gameOver' THEN datetime('now') ELSE finished_at END WHERE id = ?")
    .bind(JSON.stringify(state), JSON.stringify(state), context.req.param('id')).run();
  return context.json({ ok: true });
});

app.post('/api/judge', async (context) => context.json(await judgeGuess(await context.req.json(), context.env)));

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

export function validateQuestion(input: QuestionInput): string | null {
  if (!input.packId?.trim() || !input.text?.trim()) return 'Paket und Fragetext sind erforderlich.';
  if (!Number.isInteger(input.surveySize) || input.surveySize <= 0) return 'Die Umfragegrösse muss positiv sein.';
  if (![1, 2, 3].includes(input.difficulty)) return 'Die Schwierigkeit muss 1, 2 oder 3 sein.';
  if (!['draft', 'approved'].includes(input.status)) return 'Der Status ist ungültig.';
  if (!Array.isArray(input.answers) || input.answers.length < 4 || input.answers.length > 8) return 'Eine Frage braucht 4 bis 8 Antworten.';
  let sum = 0;
  for (let index = 0; index < input.answers.length; index += 1) {
    const answer = input.answers[index];
    if (!answer || typeof answer !== 'object') return 'Alle Antworten müssen gültige Objekte sein.';
    if (answer.rank !== index + 1) return 'Die Ränge müssen lückenlos bei 1 beginnen.';
    if (typeof answer.label !== 'string' || !answer.label.trim() || answer.label.length > 18) return 'Antworten müssen 1 bis 18 Zeichen lang sein.';
    if (!Number.isInteger(answer.points) || answer.points < 0) return 'Punkte müssen positive ganze Zahlen sein.';
    if (index > 0 && answer.points > input.answers[index - 1].points) return 'Punkte müssen absteigend sortiert sein.';
    if (!Array.isArray(answer.aliases) || !answer.aliases.every((alias) => typeof alias === 'string' && alias === alias.toLocaleLowerCase('de-CH'))) return 'Aliase müssen eine Liste kleingeschriebener Texte sein.';
    sum += answer.points;
  }
  if (sum > input.surveySize) return 'Die Punktesumme darf die Umfragegrösse nicht überschreiten.';
  return null;
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
