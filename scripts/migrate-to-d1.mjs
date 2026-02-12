import fs from 'node:fs';
import path from 'node:path';

const roomsPath = path.resolve('public/data/rooms.json');
const hubPath = path.resolve('public/data/hub.json');

function loadJson(p) {
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to read ${p}:`, e.message);
    process.exit(1);
  }
}

const roomsData = loadJson(roomsPath);
const hubData = loadJson(hubPath);

const lines = [];

// Rooms
for (const r of roomsData.rooms || []) {
  const id = r.id || `room-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const slug = (r.name || r.id || 'room').toLowerCase().replace(/\s+/g, '-');
  const title = r.name || r.id || 'Room';
  const order = r.order || 0;
  const modelUrl = r.modelUrl || '';
  lines.push(`INSERT INTO rooms(id, slug, title, "order", isLocked, modelUrl) VALUES('${id}', '${slug}', '${title.replace(/'/g,"''")}', ${order}, 0, '${modelUrl.replace(/'/g,"''")}');`);

  // Items
  for (const item of r.items || []) {
    const itemId = item.id || `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const title = item.label || 'Item';
    const type = item.type || 'collectible';
    const media_url = item.mediaUrl || '';
    const transform = JSON.stringify({ position: item.position || {x:0,y:0,z:0}, rotation: item.rotation || {x:0,y:0,z:0}, scale: item.scale || {x:1,y:1,z:1} });
    const isObjective = item.objective ? 1 : 0;
    const objective_text = item.objectiveText || '';
    lines.push(`INSERT INTO items(id, room_id, title, type, r2_key, media_url, transform, isObjective, objective_text) VALUES('${itemId}', '${id}', '${title.replace(/'/g,"''")}', '${type}', '', '${media_url.replace(/'/g,"''")}', '${transform.replace(/'/g,"''")}', ${isObjective}, '${objective_text.replace(/'/g,"''")}');`);
  }
}

const outFile = path.resolve('cloudflare/worker/migration.sql');
fs.writeFileSync(outFile, lines.join('\n') + '\n', 'utf-8');
console.log(`Wrote migration SQL to ${outFile}`);
