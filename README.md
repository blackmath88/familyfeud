# Familien-Quiz

A family game night version of the "we surveyed 100 people" quiz format (*Familien Duell* / *Family Feud*):
you don't win by being right, you win by guessing what most people said.

- **Board** on the TV in the look of the 90s German TV board (CRT, amber monospace, dotted leaders).
- **Host** screen on a laptop/phone.
- **Voice answers**: say *"Antwort … Zähne putzen"*, or hold Space and talk.
- **Smart matching**: synonyms, German sound-alike (Kölner Phonetik), typo tolerance, and Mistral as judge for unclear cases.
- **Questions in a database** (Cloudflare D1), editable, plus a family survey pack.

> Status: **planning repo**. Nothing is built yet. Implementation is done by Claude Code (local) coordinating
> workers via Orca, following `docs/PLAN.md`.

## Read in this order

| File | What |
|---|---|
| `CLAUDE.md` | Rules for the coding agents: stack, conventions, what not to build |
| `docs/CONCEPT.md` | Game rules, screens, user flows |
| `docs/ARCHITECTURE.md` | Repo layout, data model, API, game state, matcher, voice, sync |
| `docs/VISUAL_SPEC.md` | The board look, derived from `docs/reference/` |
| `docs/CONTENT.md` | Question sources (ProtoQA), import pipeline, family survey |
| `docs/PLAN.md` | Build phases, done-when criteria, Orca lanes |
| `docs/DECISIONS.md` | Decisions already made and why |
| `db/migrations/0001_init.sql` | D1 schema |
| `src/game/types.ts` | Shared type contract (all lanes build against this) |
| `seed/questions.sample.json` | 10 hand-written sample questions |

## Name

"Familien Duell" is an RTL/Fremantle brand. This project uses its own working title **FAMILIEN-QUIZ**
(one constant, easy to change) and its own logo. The reference screenshots are for mood only.
