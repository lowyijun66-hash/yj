INSERT OR IGNORE INTO hub_settings (id, modelUrl) VALUES ('main','/assets/models/backrooms_again.glb');

INSERT OR IGNORE INTO rooms (id, slug, title, "order", isLocked, modelUrl)
VALUES ('room-1','room-1','Neighbourhood',1,0,'models/neighbourhood.glb');

INSERT OR IGNORE INTO items (id, room_id, title, type, media_url, transform, isObjective, objective_text)
VALUES (
  'cassette-1',
  'room-1',
  'Cassette',
  'collectible',
  'models/cassette.glb',
  '{"position":{"x":5,"y":1.5,"z":-8},"rotation":{"x":0,"y":0,"z":0},"scale":{"x":5,"y":5,"z":5}}',
  1,
  'Find the Cassette Tape'
);

INSERT OR IGNORE INTO doors (id, room_id, transform, label)
VALUES (
  'door-room-1',
  'room-1',
  '{"position":{"x":0,"y":0,"z":-5},"rotation":{"x":0,"y":0,"z":0},"scale":{"x":0.2,"y":0.2,"z":0.2}}',
  'Neighbourhood'
);
