# Visual spec — v2

**CRT board inside a playful 2000s game-show set.**

The inner screen retains the 1990s German CRT board. The surrounding studio adds
the party: warm bulbs, colourful light, glossy reflections and oversized team
podiums. The screen is the calm, readable centre inside a lively set.

## References and scope

- `docs/reference/board-original.png`: preserve the screen look — CRT, amber
  monospace, dotted leaders, hidden `--` values and the lime total bar.
- `docs/reference/title-wall-original.png`: pixel-lettering mood only; keep our
  own **FAMILIEN-QUIZ** identity.
- `docs/reference/set-us-2000s.png`: reference for bulb-studded arches, chase lights,
  orange/gold against electric blue, reflective floor and big team name plates.
  Present and visually inspected at source commit
  `e99033580d133b02ccdf789e22ea2b01eb08c928` (image blob
  `962586c0ff5b1efe1afddac93543021b2e85723f`).

Use the 2000s US Family Feud set for atmosphere only. Do not reproduce its logo,
oval board outline or colours arranged as a brand mark, or the RTL logo.
Use our own rounded rectangular marquee and pixel lettering.

This redirect belongs to **Lane B**: `src/client/board/`,
`src/client/routes/Board.tsx`, `src/client/audio/`, and this document.
**Do not change `src/game/types.ts` or the /host visual specification.**
All effects use CSS, or one small canvas for bulbs if measured CSS cost warrants
it. No new image assets: references are comparison material, not stage textures.

## Stage & Set (`/board`)

The page is a 16:9 studio scene, replacing the plain black surround.

| Layer | Treatment |
| --- | --- |
| Studio | Deep blue-to-violet gradient, soft star field or haze made with CSS gradients |
| Light bars | Orange/amber and cyan bars behind the board; slowly pulsing, never covering text |
| Marquee | Rounded rectangular warm-gold frame with a perimeter of round glowing bulbs |
| CRT | Unchanged phosphor screen, yellow round bar, dotted answer rows and lime total |
| Podiums | Team A to the left, Team B to the right; prominent name plates and LED-style scores |
| Floor | Bottom approximately 15% of the scene; blurred, faded vertical mirror of the board |

The floor reflection is decorative and `aria-hidden`, contains no interactive
controls or duplicate IDs, and never starts a second set of audio/event effects.
Render it from the same safe `BoardView` data. Do not duplicate a live component
that would replay sounds. It remains visible with reduced motion enabled.

At 1280×720 reserve space for all eight answers, the question and lime bar first.
Fit podiums in the side/lower stage space without covering or shrinking CRT text
to make room for decoration. There is no numeric minimum font size in v1 and no
implemented baseline yet: establish and record a readable baseline in Phase 0/B
screenshots, then preserve it. Use the original reference for visual comparison.
No scrolling, clipping, logo-shaped oval or stage artwork over the screen.

### Tokens (CSS custom properties)

Scope stage styles under the board root so they do not restyle /host.

| Token | Value | Use |
| --- | --- | --- |
| `--stage-1` | `#0c1440` | studio gradient start |
| `--stage-2` | `#2a0f4a` | studio gradient end |
| `--neon-amber` | `#ffb02e` | warm light bars |
| `--neon-cyan` | `#3fd6ff` | cool light bars |
| `--gold` | `linear-gradient(180deg, #f2c14e, #b8862b)` | marquee frame |
| `--bulb-on` | `#fff2c4` | lit round bulbs |
| `--bulb-off` | `#5a4a2a` | unlit round bulbs |
| `--team-a` | `#ff8a1f` | team A podium and win chase |
| `--team-b` | `#2fa8ff` | team B podium and win chase |
| `--bar-yellow` | `#e6e021` → `#f4ef5a` | existing round/status bars, scanline stripes |
| `--screen` | `#2a2b29` | CRT background |
| `--phosphor` | `#efe7b0` | screen text and dotted leaders |
| `--phosphor-dim` | `#efe7b0` at 35% | end-revealed answers and hidden placeholders |
| `--lime` | `#d4e83a` → `#b8cc1c` | total bar |
| `--lime-ink` | `#1d1f12` | total digits |
| `--strike` | `#e0322a` | strike boxes and strike flash |
| `--led` | `#e8e02a` | title lettering on |
| `--led-off` | `#2a2a14` | title lettering off |

The old grey outer frame and black page background are superseded. The CRT
palette is unchanged. A static shadow or bevel can provide depth to the gold
frame; avoid animating full-screen blur or large box shadows every frame.

### Bulb modes and existing event contract

`idle` is a renderer mode, **not** a new `BoardEvent` variant. Resolve modes
from the existing `BoardView.lastEvent` and phase; do not change shared types.

| Mode | Trigger | Standard motion | Reduced motion |
| --- | --- | --- | --- |
| `idle` | No fresh transient event | Slow perimeter chase | Static warm bulbs |
| `reveal` | Fresh `reveal` event | Quick sparkle, then idle | Static bright highlight |
| `strike` | Fresh `strike` event | All bulbs flash red exactly twice, then idle | Static red state cue, no flashes |
| `roundWin` | Fresh `roundWin` event | Fast chase in `lastEvent.team` colour | Static winner-colour bulbs |
| `gameOver` | `gameOver` phase/event | Full rainbow chase | Static rainbow ring |

Transient effects expire locally; a retained `lastEvent` must not make a strike
flash or reveal sound repeat on every snapshot. Use `seq` to deduplicate within
the connected game. Treat the first snapshot after reconnect as state restoration,
not a backlog of sounds. Clear local effect state on a new game/connection.
Undo/restored snapshots must not replay old events.

`duplicate` shows “SCHON GENANNT”; only the confirmed `strike` event causes the
red flash. `steal` retains its yellow “KLAUEN!” cue without inventing another
bulb mode. Round intro is detected from the phase/round transition, since the
contract has no `roundIntro` event.

### Podiums (replace the old score boxes)

- Two podiums left/right of the board. Large bold sans-serif name plate, white
  text on the team's colour; score displayed as an LED-style counter.
- Team A: warm orange `--team-a`. Team B: electric blue `--team-b`.
- Light the podium and its edge bulbs when `teams[i].hasControl` is true.
- Keep strikes, current player, mic lamp and live transcript in a compact status
  strip associated with the screen. They remain visible and do not occupy rows.
- Winning team podium celebrates on round win; retain legibility during score
  changes. Control and winner are distinct states.
- Long names wrap or truncate in the name plate rather than compressing the CRT.

### Face-off buzzer moment

During `faceOff`, show two small dot-matrix-light pillars under the board.
Light the active answering team's pillar from `BoardView.activeTeam`; the host
marks the responding side through the existing face-off action. Do not add
physical/phone buzzers or a new field to `types.ts`.

This is a visual cue for the selected answering team, not independently measured
buzzer hardware. `activeTeam === null` leaves both pillars neutral. Hide the
pillars outside face-off.

## CRT screen (preserved)

### Type and structure

- **VT323**, fallback `"Courier New", monospace`.
- Uppercase screen copy. Rows: `N.` + label + dotted leader + right-aligned points.
- Hidden row: `N.` + dotted leader + `--`. Hidden slots must not acquire labels
  or points from fixtures, DOM attributes, reflection data or aria text.
- Render 4–8 rows; no scroll. Lime digits approximately 2.5× the row size.
- Keep the existing yellow round information bar, typed question, SUMME and
  lime total bar. Do not recolour the inner screen with team colours.

### CRT treatment

- Scanlines: repeating 2px dark / 2px transparent bands at about 12% opacity.
- Text glow: `0 0 2px var(--phosphor), 0 0 8px rgba(239,231,176,.35)`.
- Radial vignette; subtle opacity 0.97–1 flicker over 8s.
- Reduced motion disables flicker completely.

### Screen motion

- Question: typewriter, approximately 30ms/character; tick every second character.
- Reveal: label types at approximately 40ms/character, points count up, then ding.
  SUMME and lime total count up after the points land.
- Strike: red ✕ overlay for 900ms, then corresponding strike box remains red.
- Round end: remaining hidden answers reveal in sequence, dimmed and without
  adding points; score award remains the reducer's responsibility.
- Steal: yellow “KLAUEN! TEAM …” status cue.
- Reduced motion: instant text/counts, static state cues; no blinking or pulsing.

## Title wall

Keep our own pixel lettering **FAMILIEN-QUIZ** inside the gold bulb marquee
against the studio gradient, replacing the plain black backdrop.

Use the existing 5×7-style lettering idea and LED on/off colours, rendered with
CSS or the permitted small canvas. No original show logo, target/disc shape or
oval board silhouette. Normal motion may sweep the lettering on and chase the
border; reduced motion shows the completed lettering and static bulbs.

Round intro shows “RUNDE n” and the multiplier. Game over shows the winning
team, or a clear “UNENTSCHIEDEN” state for a tie; the marquee uses rainbow mode.
Never select an arbitrary winner colour when `winner === null`.

## Sound

WebAudio synthesis only; preserve tick, reveal ding, strike buzzer and soft
end-reveal sounds. Add:

- Round intro: short upbeat rising major arpeggio.
- Round win: cheerful “ta-da”.
- Round end: light filtered-noise crowd swell that fades away, no samples.

Audio follows the same event/phase deduplication as visuals. Do not play on
every render, in the reflection or as catch-up after reconnect.
Respect existing volume/mute behavior and browser gesture requirements. Demo
mode may offer a clearly labelled “Ton aktivieren” button; no /host redesign is
part of this redirect. When autoplay is blocked, visual playback still works.
Reduced motion does not override mute preferences.

## Demo and acceptance

`/board?demo=1` cycles safe hard-coded `BoardView` fixtures with arrow keys.
Fixtures cover setup/title, round intro, both face-off teams, reveal, playing,
each strike count, duplicate, steal, both round winners, game over and a tie.
Include 4/6/8 answers and long team names. Label demo state/mode outside the CRT
or in a collapsible demo-only panel.

- [ ] Every bulb mode is observable and returns to its correct resting state.
- [ ] Repeated identical snapshots do not replay animation/audio.
- [ ] All rows, question and total are readable at 1280×720 and 1920×1080.
- [ ] Reduced motion is tested: no chase, pulse, flicker, flashing or typewriter;
      floor reflection stays.
- [ ] Side-by-side CRT check against `board-original.png`.
- [ ] Side-by-side studio mood check against `set-us-2000s.png`: layered blue
      light panels, warm perimeter bulbs, oversized name plates and glossy floor;
      do not reproduce its oval silhouette or logos.
- [ ] Capture screenshots of title, eight-answer board, strike, face-off and
      game over, plus one reduced-motion state.
- [ ] Target sustained 60fps on a normal laptop driving a TV over HDMI. Record
      hardware/browser/display resolution and a performance trace; a headless
      screenshot or CSS inspection alone is not proof of this target.
- [ ] Confirm no host redesign, shared-type change, copied logo or new image asset.

## Host screen (`/host`)

Not retro; a clean, dark, functional control panel (laptop, also usable on a phone).

- Header: game title, round x/y, multiplier, mute/volume, "Brett öffnen", undo button.
- Left column: mini board (slot list; in Spielleiter-Modus with all answers, else only revealed ones),
  strikes, pot, scores.
- Center: **answer input** — big mic button (shows status), live transcript, text field, and the decision panel:
  - sure hit → green flash "TREFFER: ZÄHNE PUTZEN" (auto)
  - unsure → "Meinst du **HÄNDE**?" `J`/`N` (+ "KI: 92 %" if judged)
  - miss → "Kein Treffer" `X` strike / `R` nochmal
- Right column: teams & players, whose turn, control buttons (`A`/`B`), phase button (`N`).
- Keyboard cheatsheet in a collapsible footer.

## Setup (`/setup`) and Editor (`/editor`)

Same clean dark style as host. Big inputs, works on a phone. German labels.
