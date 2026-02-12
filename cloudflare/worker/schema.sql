-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  isLocked INTEGER DEFAULT 0,
  modelUrl TEXT DEFAULT ''
);

-- Items
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  title TEXT DEFAULT '',
  type TEXT NOT NULL, -- pdf|video|image|link|collectible
  r2_key TEXT DEFAULT '',
  media_url TEXT DEFAULT '',
  transform TEXT DEFAULT '{}', -- JSON {position, rotation, scale}
  isObjective INTEGER DEFAULT 0,
  objective_text TEXT DEFAULT '',
  created_at INTEGER DEFAULT (strftime('%s','now')),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- Doors (Hub)
CREATE TABLE IF NOT EXISTS doors (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL, -- The target room ID
  transform TEXT DEFAULT '{}', -- JSON {position, rotation, scale}
  label TEXT DEFAULT ''
);

-- Hub Settings
CREATE TABLE IF NOT EXISTS hub_settings (
  id TEXT PRIMARY KEY,
  modelUrl TEXT DEFAULT ''
);

-- Objectives
CREATE TABLE IF NOT EXISTS objectives (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  item_id TEXT,
  sequence_order INTEGER DEFAULT 0,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
);
