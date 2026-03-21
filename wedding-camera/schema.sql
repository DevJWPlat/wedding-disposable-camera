CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  couple_names TEXT NOT NULL,
  wedding_date TEXT NOT NULL,
  max_shots INTEGER NOT NULL DEFAULT 25,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  event_id INTEGER NOT NULL,
  device_token TEXT,
  guest_name TEXT,
  shots_taken INTEGER NOT NULL DEFAULT 0,
  shots_remaining INTEGER NOT NULL DEFAULT 25,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  event_id INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);