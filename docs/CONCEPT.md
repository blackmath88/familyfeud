# Concept

## The idea

A survey quiz for the family living room. A question appears ("Nennen Sie etwas, das man vor dem Schlafengehen macht"),
the board hides the top answers people gave, and two teams try to guess them. It's not about being right,
it's about guessing what most people said. That is the fun: arguing about what "die Leute" think.

Played with: one laptop (host), one TV (board), 4–12 people, 30–60 minutes.

## Roles

- **Host**: one person runs `/host`. Can confirm, override, undo. Also plays if they want (no secrets on the host screen
  until an answer is revealed, except in "Spielleiter-Modus", see below).
- **Teams**: exactly 2 teams in v1. Each team has 1–6 named players. A one-person team is allowed
  (so 2 people can play head to head).
- **Board**: `/board` on the TV, fullscreen, no controls.

## Setup (`/setup`)

1. Team names + player names (add/remove rows).
2. Number of rounds: 3–10 (default 5).
3. Multipliers: default `1,1,2,2,3`; last round always ×3. Editable as a simple comma list.
4. Question packs: checkboxes (e.g. "Alltag", "Essen", "Familie intern"). Questions already played in earlier games
   are skipped unless "Wiederholungen erlauben" is checked.
5. Voice: on/off, language `de-DE` (default) or `de-CH`, wake word (default "Antwort").
6. Spielleiter-Modus: on = host sees all answers from the start (classic host). Off = host sees answers only when revealed
   (host plays along). Default off.
7. "Spiel starten" → creates the game in D1, opens `/host`, shows a button "Brett öffnen" that opens `/board` in a new window.

## Round flow

```
roundIntro → faceOff → playing → (steal) → roundEnd → next round | gameOver
```

### roundIntro
Board shows "RUNDE 2 · ×1" and the question typed out letter by letter. All slots show `--`.

### faceOff
- One player from each team (rotating each round) answers. Host marks who buzzed first (keys `A` / `B`)
  or simply lets team A go first.
- First answer is matched. If it is the **#1 answer**, that team gets control immediately.
- Otherwise the other face-off player answers too. Higher-ranked hit wins control. Neither hits → next pair
  (host can also just assign control with `A`/`B`).
- Face-off hits are revealed and count toward the round pot.

### playing
- Team with control answers, players in rotation (board shows whose turn it is).
- Hit → slot reveals (typewriter + ding), points added to the round pot ("SUMME").
- Miss or duplicate of a revealed answer → strike (big red ✕, buzzer). Duplicates count as strikes
  (house rule, shown as "SCHON GENANNT").
- All slots revealed → team wins the pot → `roundEnd`.
- 3 strikes → `steal`.

### steal
- Other team gets **one** answer (they may confer; host gives them ~20 s, timer optional).
- Hit → stealing team wins the whole pot (including the stolen answer). Miss → controlling team wins the pot.

### roundEnd
- Pot × multiplier goes to the winning team. Score animation on the lime bar.
- Remaining hidden answers are revealed one after another (dimmed, no points). Families love this part.
- Host presses `N` for the next round.

### gameOver
- Board shows the final score and the winning team in the big pixel lettering. Host can "Neues Spiel (gleiche Teams)".

## Scoring

- Each answer's points = number of surveyed people who gave it (out of the survey size, typically 100).
- Board shows up to 8 slots; questions have 4–8 answers. Answers beyond slot 8 are dropped on import.
- Round score = sum of revealed points × round multiplier. No points for answers revealed at `roundEnd`.

## Answering

Three ways, all equivalent:
1. **Wake word**: player says "Antwort … Zähne putzen". Everything after the wake word until ~1.5 s silence is the guess.
2. **Push-to-talk**: host holds Space, player talks, release = submit.
3. **Typing**: host types the guess, Enter.

Each guess goes through the matcher (see ARCHITECTURE). Result:
- **sure hit** → reveal automatically.
- **unsure** → host sees "Meinst du **HÄNDE**? (J/N)". Mistral may already have been asked; its suggestion is shown.
- **miss** → host sees "Kein Treffer — Strike? (X) / Nochmal (R)". Host confirms the strike so a bad
  transcription never costs a strike automatically.

Host can always reveal a slot directly with `1`–`8`, add a strike with `X`, and undo with `Z`.

## Keyboard (host)

| Key | Action |
|---|---|
| Space (hold) | push-to-talk |
| Enter | submit typed guess |
| `1`–`8` | reveal slot manually (counts as hit for active team) |
| `X` | strike |
| `J` / `N` | confirm / reject "Meinst du …?" |
| `R` | discard guess, listen again |
| `A` / `B` | give control to team A / B (face-off) |
| `Z` | undo last action |
| `N` | next phase / next round |
| `M` | mute/unmute mic |
| `Esc` | cancel current input |

## Question editor (`/editor`)

Simple table: packs on the left, questions in the middle, the selected question's answers on the right
(text, points, synonyms as comma list). Add/edit/delete, import/export JSON per pack. Validation: points
descending, sum ≤ survey size, 4–8 answers.

## Family survey (Phase 5)

`/umfrage/:packId` — a mobile page to send to relatives: shows the pack's questions one by one, free-text answer each.
Host later opens the survey results in the editor, clusters answers (Mistral suggests clusters, host confirms),
and the counts become the points. Board line then reads "Wir haben 14 Verwandte gefragt".

## Out of scope for v1 (backlog)

- Fast-Money final round ("Doppelt oder nichts")
- Physical buzzers / phone buzzers
- More than 2 teams
- Voxtral (Mistral speech-to-text) instead of browser speech recognition
- Public hosting for other families
