# Five-minute smoke check

Prerequisite: Node.js and Chrome installed. The sample pack is intentionally labelled as estimated data.

1. Run `npm install`, `npm run db:migrate`, and `npm run db:seed`.
2. Start `npm run dev`, then open `http://127.0.0.1:5173/setup` in Chrome.
3. Keep the default two teams and three rounds, select **Beispiel**, and press **Spiel starten**.
4. Press **Brett öffnen**. Put the board window on the second display and keep the host window focused.
5. For each round press `N`, use `A` or `B` to award control, type a supplied answer and press Enter, or reveal with `1`–`8`. Use `X` for a confirmed miss, `J`/`N` for a suggestion, `R` to discard, and `Z` to undo.
6. Cause three strikes once and verify the other team receives one steal. Finish the round and press `N`; verify the score is multiplied and the next question appears in both windows.
7. Reload the host mid-round and the board after it reconnects. Confirm the exact state returns and no old sound or flash replays.
8. Finish all three rounds, verify the final winner or **UNENTSCHIEDEN**, then use **Neues Spiel · gleiche Teams**.

Automated browser coverage: with the dev server running, `npm run smoke` plays all three rounds by keyboard in two pages, verifies hidden-answer safety and BroadcastChannel sync, and checks the board at 1280×720, 390×844, and reduced motion. Screenshots are written to `/tmp/familien-quiz-1280x720.png` and `/tmp/familien-quiz-390x844.png`.

The 60fps laptop/HDMI target still requires a physical display check: connect the TV as an extended 1920×1080 display, record Chrome DevTools Performance for one reveal and one three-strike sequence, and confirm frames remain near 16.7ms without sustained drops. Headless screenshots are not evidence for this criterion.
