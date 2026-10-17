# Visual spec

Reference (mood only, do not copy logos): `docs/reference/board-original.png`, `docs/reference/title-wall-original.png`.
Target: it should feel like a 1990s German TV studio board on a CRT, shown on a modern TV. 16:9, scales to any size.

## Board (`/board`)

```
┌──────────────────────────────────────────────────────────────┐  ← light gray bevelled frame
│▓▓▓▓[■■■]▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← yellow bar (round info left: "RUNDE 2 ×1")
│ ┌──────────────────────────────────────────────────────────┐ │
│ │  NENNEN SIE ETWAS, DAS MAN VOR DEM SCHLAFENGEHEN MACHT   │ │  ← question (typed out)
│ │                                                          │ │
│ │  1.ZÄHNE PUTZEN ................................... 34   │ │
│ │  2.......................................................--│ │
│ │  3.......................................................--│ │
│ │  4.LESEN .......................................... 12   │ │
│ │  5.......................................................--│ │
│ │  6.......................................................--│ │
│ │                                         SUMME   46       │ │
│ │ ┌──────────────────────────────────────────────────────┐ │ │
│ │ │                         46                           │ │ │  ← lime bar, big dark digits
│ │ └──────────────────────────────────────────────────────┘ │ │
│ └──────────────────────────────────────────────────────────┘ │
│[TEAM A 120]  [✕][✕][ ]   ▓▓▓ MÜLLERS AM ZUG: OMA ▓▓▓   [TEAM B 80]│  ← bottom frame bar
└──────────────────────────────────────────────────────────────┘
```

### Tokens (CSS custom properties on `:root`)

| Token | Value | Use |
|---|---|---|
| `--frame` | `#c9c9c4` with a lighter top / darker bottom bevel | outer frame |
| `--frame-dark` | `#8d8d88` | inner bevel, strike boxes off |
| `--bar-yellow` | `#e6e021` → `#f4ef5a` vertical gradient, horizontal scanline stripes | top/bottom bars |
| `--screen` | `#2a2b29` | CRT background |
| `--phosphor` | `#efe7b0` | text, dotted leaders |
| `--phosphor-dim` | `#efe7b0` at 35 % | revealed-at-end answers, `--` placeholders |
| `--lime` | `#d4e83a` → `#b8cc1c` gradient | total bar |
| `--lime-ink` | `#1d1f12` | digits on the lime bar |
| `--strike` | `#e0322a` | active strike box, big ✕ |
| `--led` | `#e8e02a` | title-wall LEDs (on) |
| `--led-off` | `#2a2a14` | title-wall LEDs (off) |
| `--bg` | `#0b0b0a` | page around the board |

### Type

- Board text: **VT323** (Google Fonts) — monospace CRT look. Fallback `"Courier New", monospace`.
- Everything UPPERCASE on the board. Rows are monospace: `N.` + label + dotted leader + right-aligned points.
  Hidden row: `N.` + leader + `--`.
- Number of rows = number of answers of the question (4–8). Row height scales so the board never scrolls.
- Lime bar digits: VT323 at ~2.5× row size, centered.

### CRT effect (CSS only)

- Scanlines: `repeating-linear-gradient` 2 px dark / 2 px transparent at ~12 % opacity over the screen.
- Glow: `text-shadow: 0 0 2px var(--phosphor), 0 0 8px rgba(239,231,176,.35)`.
- Slight vignette: radial gradient darkening the corners.
- Very subtle flicker: opacity 0.97–1 animation, 8 s, can be turned off (`prefers-reduced-motion` → off).

### Motion

- **Question**: typewriter, ~30 ms per character, `tick` sound every 2nd char.
- **Reveal**: row label types out letter by letter (~40 ms/char), then the points count up from 0, then `ding`.
  The SUMME and lime bar count up after the points land.
- **Strike**: big red ✕ overlay centered over the screen for 900 ms (one ✕ per strike count: 1, 2, 3 side by side),
  buzzer sound, then the matching strike box in the bottom bar lights red.
- **Round end**: winner team's score box blinks 3×, then hidden rows reveal one by one in `--phosphor-dim`.
- **Steal**: top bar text switches to "KLAUEN! TEAM B", bar blinks slowly.
- `prefers-reduced-motion`: no flicker, no blinking, typewriter instant.

### Bottom bar

- Left and right: team score boxes (name + score, VT323 on `--frame-dark`, the team with control gets a yellow border).
- Center left: 3 strike boxes (gray `✕`, active = `--strike`).
- Center: whose turn ("AM ZUG: OMA") on the yellow bar.
- Tiny mic lamp in the corner: dim / amber / bright (see ARCHITECTURE → Voice).
- Live transcript of the current guess under the screen in small phosphor text, e.g. `» ZÄHNE PUTZEN «`.

## Title wall (start screen of `/board`, round intro, game over)

- Black background, a grid of round LEDs (CSS grid or canvas), ~120×40 dots.
- Our own title **FAMILIEN-QUIZ** drawn in a blocky 5×7-style pixel font on the LED grid, in `--led`.
  **Do not reproduce the original logo** (no disc/target shape, no "DUELL").
- Animation: LEDs switch on in a sweep from left to right, then a short chase light around the border.
- Round intro: "RUNDE 2" in LEDs, then "×2" if multiplier > 1, then cut to the board.
- Game over: winning team name in LEDs, chase light, `win` sound.

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
