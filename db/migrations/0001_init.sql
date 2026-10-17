-- Familien-Quiz — initial schema (Cloudflare D1 / SQLite)

CREATE TABLE packs (
  id          TEXT PRIMARY KEY,                -- slug, e.g. 'alltag'
  name        TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'manual'   -- manual | protoqa | survey
              CHECK (source IN ('manual', 'protoqa', 'survey')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE questions (
  id              TEXT PRIMARY KEY,
  pack_id         TEXT NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
  text            TEXT NOT NULL,
  survey_size     INTEGER NOT NULL DEFAULT 100 CHECK (survey_size > 0),
  difficulty      INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3),
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  source_ref      TEXT,                        -- e.g. ProtoQA id / original English text
  times_played    INTEGER NOT NULL DEFAULT 0,
  last_played_at  TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_questions_pack_status ON questions(pack_id, status);

CREATE TABLE answers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id  TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  rank         INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 8),
  label        TEXT NOT NULL,
  points       INTEGER NOT NULL CHECK (points >= 0),
  aliases      TEXT NOT NULL DEFAULT '[]',     -- JSON array of lowercase strings
  UNIQUE (question_id, rank)
);

CREATE TABLE games (
  id           TEXT PRIMARY KEY,               -- nanoid
  config       TEXT NOT NULL,                  -- JSON GameConfig
  state        TEXT,                           -- JSON GameState snapshot (without history)
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at  TEXT
);

CREATE TABLE game_questions (
  game_id      TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_index  INTEGER NOT NULL,
  question_id  TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  PRIMARY KEY (game_id, round_index)
);

CREATE TABLE survey_responses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  pack_id      TEXT NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
  question_id  TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  respondent   TEXT,                           -- optional first name
  text         TEXT NOT NULL,
  cluster      TEXT,                           -- assigned answer label after clustering
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_survey_question ON survey_responses(question_id);
