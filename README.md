# Familien-Quiz

A keyboard-playable, German-language family game inspired by the “we surveyed 100 people” format. The project uses its own **FAMILIEN-QUIZ** title and original presentation; the reference images are mood references, not shipped assets.

## Implemented now

- Three-round games for two teams, including face-off, control, strikes, steals, multipliers, scoring, undo, and final winner/tie screens.
- A clean host console plus a synchronized TV board in a second browser window using `BroadcastChannel`.
- Typed-answer matching with normalization, aliases, Kölner Phonetik, typo tolerance, and manual confirmation for uncertain answers.
- A responsive CRT-inspired answer board inside an original amber/blue game-show set, with podiums, light modes, synthesized WebAudio cues, mute, and reduced-motion support.
- Local resume through `localStorage`; round and final snapshots are also written to local D1.
- Cloudflare Worker APIs for packs, questions, games, pack import/export, and the optional judge endpoint.
- Automated reducer, matcher, Worker, responsive-layout, hidden-answer, synchronization, audio-control, reset, and complete-game smoke coverage.

The included **Beispiel** pack contains estimated example points, not real survey results.

## Start locally

Prerequisites: Node.js 22+ and Chrome.

```bash
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

Open <http://127.0.0.1:5173/setup>, keep the default teams and three rounds, select **Beispiel**, and choose **Spiel starten**. In the host view, choose **Brett öffnen** and move that window to the TV or second display. Click **Ton aktivieren** once on the board if the browser requests an audio gesture.

Main host controls:

| Key | Action |
| --- | --- |
| `N` | Start/advance a round, reject a pending suggestion |
| `A` / `B` | Select which team answers first in the face-off |
| `1`–`8` | Reveal an answer for the active team |
| `X` | Confirm a strike |
| `J` / `R` | Accept or discard a pending suggestion |
| `Z` | Undo the previous game action |
| `M` | Mute/unmute board sound |

The full manual game-night flow is in [`docs/SMOKE.md`](docs/SMOKE.md). Run the automated checks with:

```bash
npm test
npm run lint
npm run build
# in another terminal while npm run dev is running
npm run smoke
```

Committed screenshots and the latest software verification record live in [`docs/screenshots/`](docs/screenshots/) and [`docs/verification/`](docs/verification/).

## Roadmap, not yet implemented

- Browser speech recognition, push-to-talk, and live transcription.
- Host-side integration of the optional Mistral judge; keyboard/manual fallback is the current game path.
- The question editor UI, ProtoQA import, family survey flow, and curated survey packs.
- Cross-device/network rooms through a Durable Object. The current board and host must run in the same browser profile on one computer.
- Production D1 provisioning, Cloudflare Access, deployment, and real game-night feedback.
- Fast Money, phone buzzers, and support for more than two teams.

See [`docs/PLAN.md`](docs/PLAN.md) for phase boundaries and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the intended system design. The physical laptop-to-TV 60fps criterion remains pending until it is measured on real HDMI hardware.
