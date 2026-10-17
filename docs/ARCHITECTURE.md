# Architecture

## Overview

```
 TV (/board)  ◄── snapshots ──  Laptop (/host)  ── actions ──►  reducer (src/game)
                    │                  │
          v1: BroadcastChannel         ├── /api/questions, /api/games  ──►  Worker ──► D1
          v2: Durable Object room      ├── /api/judge  ─────────────────►  Worker ──► Mistral
                                       └── SpeechRecognition (browser)
```

One Cloudflare Worker serves the built React app (static assets) and the `/api/*` routes.
The host browser holds the game state; the board is a pure renderer of state snapshots.

## Repo layout (target)

```
/
├─ CLAUDE.md
├─ docs/                     planning docs (this folder)
├─ db/migrations/            D1 SQL migrations
├─ seed/                     question packs as JSON (+ review files from import)
├─ scripts/
│  ├─ seed-d1.ts             loads seed/*.json into D1
│  └─ import-protoqa.ts      ProtoQA → Mistral translate/adapt → seed/review/*.json
├─ src/
│  ├─ game/                  PURE logic, no DOM/React  (Lane A)
│  │  ├─ types.ts            the shared contract
│  │  ├─ reducer.ts          game phases, scoring, undo
│  │  ├─ matcher.ts          normalize → alias → phonetic → fuzzy → confidence
│  │  ├─ koelner.ts          Kölner Phonetik (~40 lines, own implementation)
│  │  ├─ normalize.ts
│  │  └─ *.test.ts
│  ├─ client/                React app
│  │  ├─ main.tsx, App.tsx   router
│  │  ├─ routes/Setup.tsx, Host.tsx, Board.tsx, Editor.tsx, Survey.tsx
│  │  ├─ board/              CRT board components  (Lane B)
│  │  ├─ host/               host panels, keyboard map
│  │  ├─ voice/              useSpeech hook: wake word + push-to-talk  (Lane D)
│  │  ├─ sync/               useSync: BroadcastChannel (v1), WebSocket (v2)
│  │  ├─ audio/sfx.ts        WebAudio synthesized sounds
│  │  └─ api.ts              typed fetch helpers
│  └─ worker/                (Lane C)
│     ├─ index.ts            Hono app, routes, asset fallback
│     ├─ judge.ts            Mistral call
│     └─ room.ts             Durable Object (Phase 6)
├─ wrangler.jsonc
├─ vite.config.ts
└─ package.json
```

## Data model (D1)

See `db/migrations/0001_init.sql`. Summary:

| Table | Purpose |
|---|---|
| `packs` | question packs ("Alltag", "Essen", "Familie intern"), `source` = `manual` / `protoqa` / `survey` |
| `questions` | text, pack, survey_size (default 100), difficulty 1–3, `status` (`draft`/`approved`), `times_played`, `last_played_at` |
| `answers` | question_id, rank, label (shown on board, UPPERCASE on render), points, `aliases` (JSON array of strings) |
| `games` | config JSON, final `state` JSON snapshot, created/finished timestamps |
| `game_questions` | which question was used in which round (for "don't repeat") |
| `survey_responses` | pack_id, question_id, respondent name (optional), raw text (Phase 5) |

Only `approved` questions are playable.

## API (Worker)

All JSON. No auth in code; Cloudflare Access protects the whole host in production. Local dev is open.

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/api/packs` | | `Pack[]` with question counts |
| GET | `/api/questions` | `?packs=a,b&count=5&excludePlayed=1` | `Question[]` random selection, approved only |
| GET | `/api/questions/:id` | | `Question` |
| POST | `/api/questions` | `QuestionInput` | `Question` |
| PUT | `/api/questions/:id` | `QuestionInput` | `Question` |
| DELETE | `/api/questions/:id` | | `{ ok }` |
| GET/POST | `/api/packs/:id/export`, `/api/packs/import` | pack JSON | |
| POST | `/api/games` | `GameConfig` + question ids | `{ id }` |
| PUT | `/api/games/:id` | `{ state }` | `{ ok }` (called at every `roundEnd` and `gameOver`) |
| POST | `/api/judge` | `JudgeRequest` | `JudgeResponse` |
| POST | `/api/survey/:packId` | `{ name?, answers: {questionId, text}[] }` | `{ ok }` (Phase 5) |
| GET | `/api/rooms/:code/ws` | WebSocket upgrade | (Phase 6) |

Types for these live in `src/game/types.ts`.

## Game state

- `GameState` (see `types.ts`) is one serializable object: config, question queue, current phase, current round
  (question, slots, strikes, pot, control, face-off), scores, player turns, pending guess, `lastEvent`, and `history`.
- `lastEvent` carries an increasing `seq` so the board knows when to play an animation/sound exactly once.
- `reducer(state, action) → state` is pure. **Undo** = the reducer pushes the previous state (minus `history`)
  onto `history` before every undoable action; `UNDO` pops it. `JUDGE_RESULT` and `DISCARD` are not undoable. Cap history at 50.
- Phases: `setup → roundIntro → faceOff → playing → steal → roundEnd → (roundIntro | gameOver)`.
  Plain `switch` on `state.phase`. No XState.
- The host persists the state to `localStorage` (try/catch) on every change so a page reload resumes the game,
  and to D1 via `PUT /api/games/:id` at round end.

### Rules the reducer enforces

- Face-off: if a face-off hit is rank 1 → control goes to that team. Otherwise the other face-off player answers;
  higher rank (= lower rank number) wins. Host can force control via `SET_CONTROL`.
- Playing: hit on unrevealed slot → reveal, pot += points. Hit on revealed slot or miss → strike (only when the
  host confirms the strike, i.e. action `STRIKE`). 3 strikes → `steal`. All revealed → `roundEnd` with winner = control.
- Steal: one guess. Hit → reveal, winner = stealing team. Miss → winner = control team.
- roundEnd: `scores[winner] += pot × multiplier`. Remaining slots get `revealedAs: 'end'` (no points).
- Player rotation: per team `turnIndex`, advances after each guess by that team.

## Matcher (`src/game/matcher.ts`)

`match(guess: string, answers: AnswerRef[], opts) → MatchResult`

Pipeline per answer (best score wins, ties → lower rank):

1. **normalize** (both sides): lowercase, `ß→ss`, strip punctuation, collapse spaces, remove the wake word and
   fillers (`ähm, äh, hm, also, ich glaube, ich würde sagen, vielleicht, ja, so, halt`), remove leading articles
   (`der die das den dem ein eine einen einem einer`).
2. **exact** normalized match against label or any alias → `1.0`
3. **token containment**: all tokens of a label/alias (len ≥ 4) appear in the guess, or vice versa → `0.9`
4. **Kölner Phonetik**: equal codes for the whole string, or for single-word alias vs any guess token → `0.85`
5. **fuzzy**: `1 − levenshtein / maxLen` on normalized strings, and again on umlaut-folded strings
   (`ä→a, ö→o, ü→u`) plus a light stem (strip trailing `en|er|e|n|s`); take max → score
6. **classify**: `score ≥ 0.85` → `sure`; `0.6 ≤ score < 0.85` → `unsure`; below → `miss`
7. If the best match is an already revealed slot and `sure` → `duplicate`

Thresholds are constants at the top of the file (`SURE = 0.85`, `UNSURE = 0.6`). Tests must cover at least:
`"Hende"→HÄNDE` (phonetic), `"die Zähne putzen"→ZÄHNE PUTZEN` (article+exact), `"zahnbürste"` via alias, `"Pyjama"` → SCHLAFANZUG AN via alias,
`"ähm ich glaube Bier"→BIER`, typo `"Schlafanzuk"`, a clear miss, a duplicate.

### Judge (Mistral) — `/api/judge`

Called by the host **only** when the local matcher returns `unsure` or `miss` and voice/LLM is enabled.

- Model: `mistral-small-latest`, `temperature: 0`, `response_format: { type: "json_object" }`, timeout 4 s.
- Prompt (German, short): question text, numbered list of answers with aliases, the guess. Asks: does the guess
  mean the same as one of the answers in everyday language? Reply `{"rank": n|null, "confidence": 0-1, "reason": "…"}`.
- On timeout/error → `{ rank: null, confidence: 0, reason: "judge_unavailable" }`; the host falls back to manual.
- **Never auto-reveals on its own.** Result is shown as "Meinst du X? (KI: 92 %)" and the host presses `J`/`N`.
  Setup option "KI darf automatisch aufdecken ab 90 %" (default off) can skip the confirmation.

## Voice (`src/client/voice/useSpeech.ts`)

Browser `SpeechRecognition` (Chrome/Edge). Firefox: voice UI hidden, keyboard only.

- **Wake word mode** (default when voice on): `continuous = true`, `interimResults = true`, `lang` from config.
  - Listen to the transcript stream; when a result contains the wake word (default `antwort`, also accept
    `antworte`, `andwort`, `antwort ist`), start capturing the text after it.
  - Capture ends on a final result + 1.5 s without new interim text → emit `onGuess(text)`.
  - Chrome ends continuous sessions on its own (~60 s / silence): auto-restart in `onend` while enabled.
  - Mic only active in phases `faceOff`, `playing`, `steal`. Board shows a small "MIKRO" lamp
    (dim = off, amber = listening, bright = capturing).
- **Push-to-talk**: Space down → `start()` (non-continuous), Space up → wait for final → `onGuess`.
- Show the live transcript on the host screen (and small on the board) so everyone sees what was understood.
- Expose `{ status, transcript, start, stop }`. No other speech libraries.

## Sync

- **v1 (Phase 2–5)**: `BroadcastChannel("fq:" + gameId)`. Host posts `{ type: "board", view }` (`SyncMessage`) after every
  dispatch; board posts `{ type: "hello" }` on load and the host answers with the current view. Same browser, two windows
  (laptop screen + TV via HDMI as extended display).
- **v2 (Phase 6)**: Durable Object `Room`, SQLite backend (free plan), WebSocket **Hibernation API**.
  - Host creates a 4-letter room code; `/board?room=ABCD` on any device.
  - Host sends board views; the room stores the latest view and broadcasts to all boards. Boards are read-only.
  - `useSync` hides the transport: same interface for both versions.

## Board snapshot

The board must not leak hidden answers: the host sends a **board view** (`BoardView` in `types.ts`), derived by
`toBoardView(state, ui)` (`ui` = mic status + live transcript), where hidden slots carry no label/points. This matters once the board runs on another device.

## Sounds (`src/client/audio/sfx.ts`)

WebAudio only, no audio files: `ding` (two short sine tones), `strike` (sawtooth ~110 Hz, 0.6 s),
`tick` (typewriter, very short noise burst per letter), `win` (rising arpeggio), `reveal-end` (soft low tone).
Volume control + mute in host header.
