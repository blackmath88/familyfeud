# Decisions

Short log. Newest at the bottom. Format: decision — why.

## Made during planning (2026-10-17)

1. **Repo with real backend, not a single HTML file** — questions in a database, games persisted, editor, survey.
2. **Cloudflare Worker + D1 + Access** — same stack as other projects (180° Feedback, FFOS); free tier is enough.
3. **Mistral server-side only** — key stays a Worker secret; also avoids browser CORS/hosting limits.
4. **Durable Objects only for cross-device sync (Phase 6)** — available on the Workers Free plan with the SQLite
   backend (100k requests/day, 13,000 GB-s/day); WebSocket Hibernation keeps duration near zero. v1 uses
   BroadcastChannel (two windows, one laptop), which is enough for the first game night.
5. **No XState** — ~7 phases; a pure reducer with a `switch` is easier to read and test. Undo via state history.
6. **Matcher = local pipeline first, LLM second** — normalize → aliases → Kölner Phonetik → fuzzy → confidence.
   Mistral judges only unsure/miss cases and never reveals without host confirmation (unless the setup toggle is on).
7. **A miss never costs a strike automatically** — host confirms with `X`, because speech recognition errors
   must not decide the game.
8. **Wake word "Antwort" + Space push-to-talk + typing** — all three always available; keyboard-only must work.
9. **Browser SpeechRecognition (Chrome/Edge), `de-DE` default** — Swiss German dialect is recognized poorly;
   players speak Hochdeutsch. `de-CH` selectable for testing. Voxtral = backlog.
10. **Host is authoritative, board renders a `BoardView`** — no hidden answers ever leave the host.
11. **Own title "FAMILIEN-QUIZ", own pixel logo, synthesized sounds** — "Familien Duell" is an RTL/Fremantle brand.
12. **Questions: ProtoQA (translated/adapted with Mistral, human-reviewed) + own family survey** — no structured
    German dataset exists; US rankings partly don't fit, the family survey is the more fun source anyway.
13. **Exactly 2 teams in v1**, each 1–6 players.
14. **UI German (Swiss spelling, "ss"), code/docs English.**
