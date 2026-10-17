# First build handoff — Familien-Quiz

Recorded 17 October 2026. Prepared for a local Claude Code coordinator using the
orchestrate-work and route-orca-work skills. **Prepared, not dispatched.**

## Outcome

Deliver the first complete **keyboard-playable three-round game**:
setup → host → synchronised TV board → face-off/playing/steal → final score,
using local D1 and the v2 studio visual direction. Return a review branch, focused
commits, a PR and reproducible validation. Preserve the broader roadmap.

This is the implementation target for Phases 0–2. Voice, live Mistral calls,
editor UI, deployment, content imports, surveys and cross-device Durable Objects
remain later phases. Their existing specifications are not deleted or accepted
as implemented.

## Source and observed state

- Repository: `blackmath88/familyfeud`.
- Preparation base: `e99033580d133b02ccdf789e22ea2b01eb08c928`.
- Shared contract blob: `9620b071e9702b721227cba69165ef2103e25d2c`
  (`src/game/types.ts`), must stay unchanged.
- Main currently contains planning docs, initial D1 migration, shared types and
  10 sample questions. There is no package manifest or runnable app yet.
- No Observatory configuration/snapshot, AGENTS.md, open PR or competing branch
  was found at the initial inspection. Follow `CLAUDE.md`; refresh state before
  actual execution rather than treating this dated note as a lock.
- All three reference images are present at this base. The CRT and US set images
  were visually inspected. Use those exact files; do not search for substitutes.
- The 10 sample questions pass the documented structural checks: 4–8 answers,
  contiguous ranks, descending points, sum within survey size, labels at most
  18 characters and lowercase aliases. Counts are estimates, not a real survey.
- Current chat read of Weavr `/api/state`: HTTP 302 to Cloudflare Access sign-in.
  Canonical Project/Mission/Session/Need/Run state is **unverified**.
- Local runtime discovery: `orca-ide skills get orchestration` failed with
  `orca-ide: command not found`. No Orca worker or Weavr Mission was launched.
- This preparation is direct GitHub documentation work. It is not a successful
  Weavr execution, registered Project, accepted Mission or completed build.

## Read before execution

1. Current `blackmath88/weavr/docs/CHATGPT-OPERATING-CONTRACT.md`.
2. This repository's `CLAUDE.md`.
3. `docs/CONCEPT.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`.
4. `docs/PLAN.md` and **v2** `docs/VISUAL_SPEC.md`.
5. `src/game/types.ts`, `docs/CONTENT.md` and the seed pack.
6. The installed orchestration and routing skills, then Orca's own actual
   orchestration guide through its documented discovery command.

Refresh current GitHub branches/PRs and any newly added Observatory evidence.
Inspect actual authenticated Weavr state before any governed operational action.
If the read is blocked, report it; do not assume the project has no active work.
No command replay, invented Mission ID or direct canonical database write.

## Execution scope

### Phase 0 — foundation, one coordinator

Follow the existing Phase 0 list. Scaffold the prescribed React 18/TypeScript/Vite,
Cloudflare plugin, Hono and local D1 stack. Use the existing migration and seed.
Create the declared scripts and route placeholders, validate seed input, and
keep provider secrets outside source/client assets. No remote database creation.

Get local dev, migration, seed and meaningful smoke checks running before splitting
the work. Pin package versions and commit the lockfile. Verify current official
tool documentation when configuring the Cloudflare/Vite integration.

### Phase 1 — isolated lane worktrees

| Packet | Write scope | Required result |
| --- | --- | --- |
| A | `src/game/**`, except `types.ts` | Pure reducer, matcher, normalisation/phonetics, safe BoardView and tests |
| B | `src/client/board/**`, `src/client/routes/Board.tsx`, `src/client/audio/**` | v2 stage, preserved CRT, demo states, synthesized sound and UI checks |
| C | `src/worker/**`, `scripts/seed-d1.ts`, `db/**` | Local API, validation, D1 persistence and mock/unavailable judge behavior |

Use at most two concurrent workers by default, including possibly-live attempts.
Queue the third lane; separate worktrees alone do not establish credential
isolation. The coordinator owns shared package/config/lockfiles and integration.
Request changes to shared setup through the coordinator rather than editing
outside the lane. No worker may change `types.ts`.

Select eligible local/Mistral routes when suitable and actually configured;
otherwise use an eligible subscription route. No paid API fallback is authorized.
A cloud CLI hosted on Nebu is not local inference. Record actual host, harness,
provider and effective model where observable; unknown remains unknown.
Do not start extra model services or displace another project to make a route fit.

The existing Lane C live-key judge criterion is **deferred for this milestone**:
exercise mock mode and missing-key/timeout fallback, but do not spend on a live
Mistral request. Do not tick the live criterion. Phase 2 must work with LLM off.

### Phase 2 — coordinator integration

Wire setup, host, reducer, API and BroadcastChannel. The host follows its original
functional visual spec; v2 must not restyle it. Only safe BoardView snapshots
reach the TV window, including on hello/reconnect. Board code must never fetch
the hidden answer queue to simplify rendering.

Persist host state locally for reload and save at round boundaries to D1.
Play a full three-round game with keyboard only. Provide the five-minute smoke
check in `docs/SMOKE.md`.

Integrate lane commits only into the owned review branch. Do not merge main,
deploy, create remote D1/Access resources, change secrets, enable recurring jobs,
dispatch a Mission or waive a Need based on this handoff.

## Existing-contract details to settle in implementation

These are implementation requirements, not permission to edit shared types:

- `idle` and bulb modes stay renderer-local; phase changes provide round-intro
  cues without extending `BoardEvent`.
- `activeTeam` during face-off represents the selected answering side; no real
  buzzer hardware is claimed.
- Use `lastEvent.seq` to avoid repeated effects. Suppress initial/reconnect
  snapshots as historical state, and handle undo without replaying old sounds.
- `winner === null` is a tie; do not pick a team arbitrarily.
- Reflection uses only safe BoardView data and has no sound/event handlers.
- Match manual overrides by rank, not by array position assumptions.
- A pending judge response must not apply to a newer guess or changed round;
  the host can correlate requests locally without changing `types.ts`.
- Sample pack counts must remain labelled as estimates in first-use guidance.
- Audio unlock is browser-dependent: demo may expose “Ton aktivieren”; blocked
  audio must not block keyboard gameplay or the TV board.

## Acceptance and evidence

Do not treat a finished worker or a green typecheck as a playable game.

- Pure logic tests: matcher cases, complete game, successful/failed steal,
  duplicate confirmation, multipliers, all-revealed win, undo and hidden-answer
  omission from serialised BoardView.
- Local API/seed checks: invalid input rejected; only approved questions selected;
  played-question tracking works; export/import round-trip; mock/unavailable judge.
- Integration: three-round keyboard game with two windows; host and board reload;
  manual fallback; zero hidden labels/points in board messages or DOM.
- Visual: all v2 modes, both team colours, tie, 4/6/8 answers and long names;
  screenshots at 1280×720 and 1920×1080; reduced-motion check; compare the CRT
  and stage separately against their respective references.
- Performance: record a real laptop/HDMI trace before claiming 60fps. If that
  hardware is unavailable, mark this criterion pending and provide exact steps.
- Scope: unchanged shared-type blob and no v2 host redesign; no copied logos,
  sample audio, stage image assets or remote-service writes.
- Run the created test/typecheck/build commands and record exact results and
  implementation commit. Distinguish local mocks, live observations, self-review
  and qualified independent review. Do not claim a live model test from fixtures.

Seek qualified independent review on the exact candidate commit. If no bounded,
credential-isolated, enforced read-only review route exists, keep the PR draft
and explicitly report self-review only.

## Bounds, stopping and handoff

Default worker session budget: 30 minutes total, maximum two concurrent workers,
one focused repair per packet within that same deadline, no new paid API spend.
Use an actual runtime supervisor/timeout where unattended work is requested;
prompt text is not deadline enforcement. Do not sacrifice acceptance checks to
claim the whole milestone fits one session. Checkpoint cleanly and identify the
next bounded packet if the budget expires.

Do not retry a possibly-live worker elsewhere. Observe settlement before
releasing its scope or replacing its route. Retain a compact task ledger with
base, owned paths, runtime identities, observed settlement, commits and checks.

This document is a build packet, not canonical Weavr state. Registration,
Mission acceptance and dispatch require current legal state and explicit intent.
Approved conversational Weavr control writes go through **new immutable
`.weavr/inbox` commands** after verifying the actual command schema and ingress
setup. This repository currently has no command-bus setup; do not copy xl-lab's
scheduled replay design or pretend a queued JSON file alone is a live dispatch.
