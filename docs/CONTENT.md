# Content: questions & answers

## Sources

| Pack | Source | Status |
|---|---|---|
| `beispiel` | `seed/questions.sample.json`, 10 hand-written questions, **points are estimates** | ready (Phase 0) |
| `alltag`, `essen`, `freizeit`, … | ProtoQA, translated and adapted with Mistral, human-reviewed | Phase 5 |
| `familie` | own family survey via `/umfrage/:packId` | Phase 5 |

### ProtoQA

- Research dataset of Family-Feud-style prompts with ranked answer clusters and counts.
  Paper: <https://arxiv.org/abs/2005.00771>. Hugging Face: `community-datasets/proto_qa`.
- The train set (~9.7k questions) comes from Family-Feud-style sources with answer counts; the dev/test sets
  (a few hundred) were collected by surveying ~100 people per question.
- **Agent task before import:** inspect the actual dataset fields (download a sample first; do not assume field names),
  check the license on the dataset card, and add the required attribution to `README.md`.
- English only, US culture → needs adaptation, not just translation.

## Import pipeline (`scripts/import-protoqa.ts`, Phase 5)

Runs locally with `MISTRAL_API_KEY` in `.dev.vars` / env. Never in the Worker.

1. **Fetch** the dataset (HF datasets-server JSON API or parquet download), keep questions with 4–8 answer clusters
   and counts.
2. **Filter** (rules first, then Mistral): drop US-only topics (Thanksgiving, baseball, US brands, US TV), adult topics,
   anything not family-friendly (kids play too).
3. **Translate + adapt** with Mistral (`mistral-large-latest`, JSON mode), one question per call:
   - question phrased like the show: "Nennen Sie …" / "Was … ?"
   - answer labels short (1–3 words, ≤ 18 chars so they fit the board), Hochdeutsch, Swiss spelling (ss)
   - **aliases**: 3–8 per answer (synonyms, singular/plural, common spoken variants)
   - if the US ranking is clearly wrong for Switzerland, the model may set `"needsReview": "ranking"` but must not
     invent new points
   - keep original English in `source.en` for review
4. **Write** `seed/review/protoqa-<pack>.review.json` with `status: "draft"`.
5. **Review** (human, in `/editor` or the JSON): set `status: "approved"`, fix labels/aliases.
6. `npm run db:seed` loads approved questions.

Target for first real game night: **~60 approved questions** across 4–5 packs.

## Family survey (Phase 5)

1. In the editor: create pack `familie`, enter question texts only (no answers).
2. Share `/umfrage/familie` (behind Cloudflare Access or a simple pack-level share token — decide in Phase 5,
   note in DECISIONS).
3. Relatives answer free text. Stored in `survey_responses`.
4. Editor → "Antworten clustern": Mistral groups raw answers into clusters with a label + aliases; host merges/splits,
   counts become points, `survey_size` = number of respondents.
5. Board line shows "WIR HABEN 14 LEUTE GEFRAGT" (uses `survey_size`).

## JSON format (`seed/*.json`, import/export)

```json
{
  "pack": { "id": "beispiel", "name": "Beispiel", "source": "manual" },
  "questions": [
    {
      "id": "bsp-001",
      "text": "Nennen Sie etwas, das man vor dem Schlafengehen macht.",
      "surveySize": 100,
      "difficulty": 1,
      "status": "approved",
      "answers": [
        { "rank": 1, "label": "Zähne putzen", "points": 38, "aliases": ["zahnbürste", "zähneputzen"] }
      ]
    }
  ]
}
```

Rules (validated by `seed-d1.ts` and the editor): ranks 1..n contiguous, points non-increasing,
sum ≤ `surveySize`, 4–8 answers, label ≤ 18 characters, aliases lowercase.
