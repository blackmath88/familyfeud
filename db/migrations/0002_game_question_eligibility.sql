-- Keep game creation eligibility atomic with the game/question writes.
-- D1 batches execute transactionally, so aborting this trigger rolls back the batch.

CREATE TRIGGER game_questions_require_playable_question
BEFORE INSERT ON game_questions
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM questions q
    JOIN games g ON g.id = NEW.game_id
    WHERE q.id = NEW.question_id
      AND q.status = 'approved'
      AND EXISTS (
        SELECT 1 FROM json_each(g.config, '$.packIds') AS configured_pack
        WHERE configured_pack.value = q.pack_id
      )
      AND (
        json_extract(g.config, '$.allowRepeats') = 1
        OR q.times_played = 0
      )
  ) THEN RAISE(ABORT, 'question_not_playable') END;
END;
