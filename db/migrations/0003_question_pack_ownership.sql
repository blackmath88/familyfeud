-- A question ID belongs to one pack for its lifetime. This also closes the
-- race between import preflight and the transactional bulk upsert.

CREATE TRIGGER questions_keep_pack_owner
BEFORE UPDATE OF pack_id ON questions
WHEN OLD.pack_id <> NEW.pack_id
BEGIN
  SELECT RAISE(ABORT, 'question_pack_collision');
END;
