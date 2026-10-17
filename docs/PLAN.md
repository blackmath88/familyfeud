# Build plan

Coordinator: Claude Code (local). Workers: Orca worktrees (Claude Code or Mistral Vibe).
Each lane gets the brief below its heading, works only in its listed folders, and must meet its **done when** list.
The coordinator integrates lanes into a review branch, runs `npm run test`, and does the smoke check before the next phase. This is not authority to merge to main or deploy.

First executable handoff: [BUILD_HANDOFF.md](BUILD_HANDOFF.md). Initial delivery target is Phases 0–2 with Visual direction v2; later phases retain their existing order and require their own readiness/authority checks.

```
Phase 0  Foundation ─────────────── solo
Phase 1  ┬ Lane A  game core        ┐
         ├ Lane B  board UI         ├ parallel
         └ Lane C  worker API       ┘
Phase 2  Playable game (keyboard) ── coordinator integrates A+B+C
Phase 3  ┬ Lane D  voice + judge    ┐
         └ Lane E  editor           ┘ parallel (D may start during Phase 2)
Phase 4  Deploy + first game night ─ solo           ← milestone: real family test
Phase 5  ┬ Lane F  ProtoQA import   ┐ parallel
         └ Lane G  family survey    ┘
Phase 6  Cross-device sync (Durable Object)
Backlog  Fast Money, phone buzzers, Voxtral, >2 teams
```

---

## Phase 0 — Foundation (solo, coordinator)

- Vite + React + TS, `@cloudflare/vite-plugin`, `wrangler.jsonc` with D1 binding `DB` (database `familien-quiz`)
  and placeholder for the Durable Object (commented out until Phase 6).
- Hono Worker in `src/worker/index.ts` with `GET /api/health` and `GET /api/packs`.
- Copy `db/migrations/0001_init.sql`; npm scripts from `CLAUDE.md`.
- `scripts/seed-d1.ts`: validates (rules in `docs/CONTENT.md`) and loads `seed/*.json` into local D1
  (generate SQL, run via `wrangler d1 execute --local --file`).
- React Router with empty routes `/setup`, `/host`, `/board`, `/editor`; `/` redirects to `/setup`.
- Vitest configured for `src/game/**`. Keep `src/game/types.ts` as provided.
- Google Font VT323 linked in `index.html`.

**Done when**
- [ ] `npm run dev` serves all four routes (placeholder text)
- [ ] `npm run db:migrate && npm run db:seed` → `GET /api/packs` returns pack `beispiel` with 10 questions
- [ ] `npm run test` runs (a trivial test passes)
- [ ] `.dev.vars.example` with `MISTRAL_API_KEY=`; `.dev.vars` git-ignored

---

## Phase 1 — Core (3 parallel lanes)

### Lane A — game core · folders: `src/game/`
Brief: implement `normalize.ts`, `koelner.ts`, `matcher.ts`, `reducer.ts`, `boardView.ts` exactly as specified in
`docs/ARCHITECTURE.md` (Game state, Rules, Matcher) and `docs/CONCEPT.md` (Round flow, Scoring), against
`types.ts`. Pure TS, no DOM. Tests for everything.

**Done when**
- [ ] matcher tests listed in ARCHITECTURE pass (+ Kölner Phonetik reference cases, e.g. "Müller-Lüdenscheidt" → `65752682`, "Wikipedia" → `3412`, "Hende" = "Hände" → `062`)
- [ ] reducer test plays a scripted full game: face-off, hits, duplicate strike, 3 strikes, successful steal,
      failed steal, all-revealed win, multipliers, roundEnd reveal, gameOver
- [ ] `UNDO` restores exactly the previous state for every undoable action
- [ ] `toBoardView` never contains labels/points of hidden slots (test)

### Lane B — board UI · folders: `src/client/board/`, `src/client/routes/Board.tsx`, `src/client/audio/`

Brief: implement **Visual direction v2 — CRT board inside a playful 2000s game-show
set**, per `docs/VISUAL_SPEC.md`. Render only a `BoardView` prop. Keep the original
CRT screen inside an original rounded gold bulb marquee, on a blue/violet studio
stage with amber/cyan light bars, reflection, team podiums and face-off pillars.
Use `board-original.png` for the screen and `set-us-2000s.png` for studio mood;
do not copy logos or the oval board silhouette.

Include `/board?demo=1` with arrow-key fixtures for every phase and bulb mode.
Derive modes and audio cues from existing events/phase changes: `idle` is a local
render mode, not a new shared event. Deduplicate transient effects by event
sequence; the reflection must never start sound or effect handlers.
Do not edit `src/game/types.ts` or redesign `/host`.

**Done when**
- [ ] demo shows idle, reveal, strike, both round-win colours and game-over rainbow modes
- [ ] both face-off pillars, title wall, steal, duplicate and tie states are demonstrated
- [ ] 4, 6 and 8 answers, question and lime total fit at 1920×1080 and 1280×720 without scrolling or shrinking the CRT for decoration
- [ ] gold marquee, layered lights, podiums and faded floor reflection match v2 direction
- [ ] reveal = typewriter + count-up + ding; strike = big ✕ + buzzer + exactly two red bulb flashes
- [ ] round intro arpeggio, round-win ta-da and synthesized crowd swell obey mute and browser audio activation
- [ ] repeat snapshots and reconnect do not replay old sounds/effects
- [ ] reduced motion: static bulbs, instant text/counts, no pulse/flicker/chase; reflection stays
- [ ] side-by-side screen and studio screenshots reviewed against both source images
- [ ] no copied logo/oval outline, no new image assets, no host redesign or shared-type diff
- [ ] actual laptop/HDMI 60fps result recorded, or explicitly pending with a reproducible performance check

### Lane C — worker API · folders: `src/worker/`, `scripts/seed-d1.ts`, `db/`
Brief: implement all `/api/*` routes from ARCHITECTURE except survey and rooms. Include `/api/judge` calling Mistral
as specified (with a `MOCK_JUDGE=1` env mode that returns a deterministic answer for local work without a key).
Input validation by hand (no zod unless noted in DECISIONS).

**Done when**
- [ ] `GET /api/questions?packs=beispiel&count=5&excludePlayed=1` returns 5 random approved questions, no repeats
      after they are linked to a game
- [ ] CRUD on questions works and rejects invalid input (rules from CONTENT) with 400 + German message
- [ ] `POST /api/judge` with a real key: "Nachthemd anziehen" vs answers of `bsp-001` → rank of
      "Schlafanzug an", confidence ≥ 0.8; with no key/timeout → `judge_unavailable` within 5 s
- [ ] pack export → import round-trips

---

## Phase 2 — Playable game, keyboard only (coordinator)

Integrate A + B + C: `/setup` (per CONCEPT → Setup), `/host` (per VISUAL_SPEC → Host), `useSync` v1
(BroadcastChannel), keyboard map from CONCEPT, `localStorage` resume, `PUT /api/games/:id` at round end.

**Done when**
- [ ] two players can play a complete 3-round game with keyboard only; board in a second window updates live
- [ ] host reload mid-round resumes the exact state; board reload re-syncs
- [ ] typed guesses go through the matcher; unsure → J/N; miss → X/R
- [ ] played questions are not offered again in the next game
- [ ] smoke test written down in `docs/SMOKE.md` (steps a human runs in 5 min)

---

## Phase 3 — Voice + editor (parallel)

### Lane D — voice + judge · folders: `src/client/voice/`, host decision panel
Brief: `useSpeech` per ARCHITECTURE → Voice, a dev page `/dev/voice` showing status + transcript + emitted guesses.
Then wire into `/host`: guess → matcher → (unsure|miss) → `/api/judge` → decision panel. Mic lamp + transcript on board.

**Done when**
- [ ] "Antwort Zähne putzen" (spoken, Chrome, de-DE) produces exactly one guess "zähne putzen"
- [ ] background talk without the wake word produces no guess over 2 minutes
- [ ] recognition auto-restarts after Chrome ends the session
- [ ] Space push-to-talk works and has priority over wake-word mode
- [ ] judge result appears as "Meinst du …? (KI: n %)"; judge failure falls back silently to manual
- [ ] Firefox: voice controls hidden, game still playable

### Lane E — editor · folders: `src/client/routes/Editor.tsx`, `src/client/editor/`
Brief: `/editor` per CONCEPT → Question editor, using Lane C endpoints.

**Done when**
- [ ] create/edit/delete pack, question, answers; validation messages in German
- [ ] import/export pack JSON
- [ ] draft vs approved toggle; only approved questions appear in games

---

## Phase 4 — Deploy + first game night (solo)

- Remote D1 created + migrated + seeded, `MISTRAL_API_KEY` set via `wrangler secret put`.
- Cloudflare Access application on the Worker's hostname (email OTP for the family's addresses).
- `npm run deploy`.

**Done when**
- [ ] production URL works behind Access, on the TV via laptop HDMI (extended display, board fullscreen)
- [ ] one real game night played; issues collected in `docs/FEEDBACK.md`

---

## Phase 5 — Content (parallel)

### Lane F — ProtoQA import · folders: `scripts/import-protoqa.ts`, `seed/review/`
Brief: per `docs/CONTENT.md` → Import pipeline. Start with 80 candidates, expect ~60 to survive review.

**Done when**
- [ ] license checked, attribution in README
- [ ] review files generated with German labels ≤ 18 chars and 3–8 aliases each
- [ ] after human review, `db:seed` loads approved questions into local and remote D1

### Lane G — family survey · folders: `src/client/routes/Survey.tsx`, `src/worker/` (survey routes), editor clustering panel
Brief: per `docs/CONTENT.md` → Family survey. Decide the access model (Access vs share token) and log it in DECISIONS.

**Done when**
- [ ] a relative on a phone can answer a pack's questions
- [ ] editor clusters responses with Mistral suggestions; host confirms; points = counts; `survey_size` set
- [ ] board shows "WIR HABEN n LEUTE GEFRAGT"

---

## Phase 6 — Cross-device sync

Durable Object `Room` (SQLite backend → Workers Free plan), WebSocket Hibernation API, per ARCHITECTURE → Sync v2.
`useSync` switches transport when a room code is present.

**Done when**
- [ ] host on laptop, board on a smart-TV browser or second device via `/board?room=ABCD`
- [ ] board reconnects after Wi-Fi drop and shows the latest snapshot
- [ ] board payload contains no hidden answers (checked in the network tab)

---

## Lane brief template (for Orca)

```
You are working in lane <X> of the Familien-Quiz repo.
Read CLAUDE.md, docs/ARCHITECTURE.md, docs/CONCEPT.md, docs/VISUAL_SPEC.md (if UI), and docs/PLAN.md → Lane <X>.
Only change files in: <folders>. Build against src/game/types.ts; do not edit it.
Finish when every "done when" box of your lane is true; list them in your final message with how you verified each.
```
