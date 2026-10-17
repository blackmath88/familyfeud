import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import type { PackFile, QuestionInput } from '../src/game/types';
import { validateQuestion } from '../src/worker/index';

const root = process.cwd();
const seedDirectory = path.join(root, 'seed');
const files = (await readdir(seedDirectory)).filter((file) => file.endsWith('.json'));
const statements = ['PRAGMA foreign_keys = ON;'];

for (const file of files) {
  const pack = JSON.parse(await readFile(path.join(seedDirectory, file), 'utf8')) as PackFile;
  if (!pack.pack?.id || !pack.pack.name || !pack.pack.source) throw new Error(`${file}: ungültiges Paket`);
  statements.push(`INSERT INTO packs (id, name, source) VALUES (${sql(pack.pack.id)}, ${sql(pack.pack.name)}, ${sql(pack.pack.source)}) ON CONFLICT(id) DO UPDATE SET name=excluded.name, source=excluded.source;`);
  for (const question of pack.questions) {
    const normalized: QuestionInput = { ...question, packId: pack.pack.id };
    const error = validateQuestion(normalized);
    if (error || !question.id) throw new Error(`${file}/${question.id ?? '?'}: ${error ?? 'ID fehlt'}`);
    statements.push(`INSERT INTO questions (id, pack_id, text, survey_size, difficulty, status) VALUES (${sql(question.id)}, ${sql(pack.pack.id)}, ${sql(question.text)}, ${question.surveySize}, ${question.difficulty}, ${sql(question.status)}) ON CONFLICT(id) DO UPDATE SET pack_id=excluded.pack_id, text=excluded.text, survey_size=excluded.survey_size, difficulty=excluded.difficulty, status=excluded.status;`);
    statements.push(`DELETE FROM answers WHERE question_id = ${sql(question.id)};`);
    for (const answer of question.answers) {
      statements.push(`INSERT INTO answers (question_id, rank, label, points, aliases) VALUES (${sql(question.id)}, ${answer.rank}, ${sql(answer.label)}, ${answer.points}, ${sql(JSON.stringify(answer.aliases))});`);
    }
  }
}

const tempDirectory = path.join(root, '.wrangler', 'tmp');
await mkdir(tempDirectory, { recursive: true });
const output = path.join(tempDirectory, 'seed.sql');
await writeFile(output, `${statements.join('\n')}\n`);
const result = spawnSync('npx', ['wrangler', 'd1', 'execute', 'familien-quiz', '--local', '--file', output], { cwd: root, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`${files.length} Paketdatei(en) validiert und geladen.`);

function sql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
