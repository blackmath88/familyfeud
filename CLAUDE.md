# CLAUDE.md — Familien-Quiz

You are building a **prototype for family game nights**, not an enterprise product.
Read `docs/PLAN.md` for what to build next, and `docs/ARCHITECTURE.md` for how.

## Stack (fixed)

- **Cloudflare Worker** (TypeScript) serving API + static assets, via `@cloudflare/vite-plugin`
- **D1** (SQLite) for questions, games, survey data
- **Durable Objects** (SQLite backend, works on the Workers Free plan) only in Phase 6 for TV ↔ phone sync
- **React 18 + Vite + TypeScript** frontend, React Router for `/setup`, `/board`, `/host`, `/editor`
- **Vitest** for the pure game logic
- **Mistral API** server-side only (`MISTRAL_API_KEY` as Worker secret, never in the client bundle)
- **Hono** is allowed for Worker routing; nothing heavier
- Package manager: **npm**

## Language

- All UI text: **German** (Hochdeutsch, Swiss spelling: "ss" instead of "ß").
- Code, comments, docs, commit messages: English.

## Rules

1. **Prototype scope.** No auth layers in code (Cloudflare Access handles it at the edge), no config systems,
   no plugin architecture, no error-boundary frameworks, no i18n library, no state-management library.
   A `useReducer` + one context is enough.
2. **`src/game/` is pure.** No React, no DOM, no `fetch`, no `Date.now()` inside reducers
   (pass time in actions). Everything there gets Vitest tests.
3. **`src/game/types.ts` is the contract.** Lanes build against it in parallel. If you must change it,
   change it in its own commit with a one-line reason, and note it in `docs/DECISIONS.md`.
4. **Host is authoritative.** Only the host screen dispatches game actions. The board only renders snapshots.
5. **Every voice/LLM path has a manual fallback.** The game must be fully playable with keyboard only.
6. **No copyrighted assets.** No RTL logo, no show audio. Sounds are synthesized with WebAudio.
   The title wall is our own pixel lettering.
7. **Small commits per task**, message format `phase-N: what`. Each phase ends with its done-when checklist
   from `docs/PLAN.md` ticked in the PR/commit description.
8. Do not add dependencies beyond the list above without writing the reason in `docs/DECISIONS.md`.
   Pre-approved small ones: `react-router-dom`, `hono`, `nanoid`.

## Commands (to be created in Phase 0)

```bash
npm run dev          # vite + worker locally (D1 local)
npm run test         # vitest
npm run db:migrate   # wrangler d1 migrations apply familien-quiz --local
npm run db:seed      # load seed/*.json into local D1
npm run deploy       # wrangler deploy
```

## Orca / parallel work

`docs/PLAN.md` marks which tasks can run in parallel worktrees ("lanes").
Phase 0 runs alone. Lanes only touch the folders listed for them, so merges stay trivial.
The coordinator (Claude Code) merges lanes and runs `npm run test` + a manual smoke check after each merge.
