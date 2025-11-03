-- Episodes table for TV show file lookup
CREATE TABLE IF NOT EXISTS episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  series TEXT NOT NULL,
  season INTEGER NOT NULL,
  episode INTEGER NOT NULL,
  filepath TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups by series, season, episode
CREATE INDEX IF NOT EXISTS idx_episodes_lookup
ON episodes(series, season, episode);

-- Index for fuzzy series name matching (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_episodes_series
ON episodes(series COLLATE NOCASE);
