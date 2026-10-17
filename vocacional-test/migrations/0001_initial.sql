CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  participant_code TEXT NOT NULL UNIQUE,
  name TEXT,
  age INTEGER,
  response_date TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  submission_id TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  answer TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(participant_id, item_number)
);

CREATE INDEX IF NOT EXISTS idx_answers_participant ON answers(participant_id);
