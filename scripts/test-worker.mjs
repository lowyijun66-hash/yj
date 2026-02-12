import worker from '../cloudflare/worker/media-api.js';

const env = {
  DB: {
    prepare(sql) {
      return {
        bind(...args) {
          return this;
        },
        async all() {
          if (sql.includes('FROM rooms')) {
            return { results: [{ id: 'room-1', slug: 'room-1', title: 'Neighbourhood', order: 1, isLocked: 0 }] };
          }
          return { results: [] };
        },
        async first() {
          if (sql.includes('FROM rooms')) {
            return { id: 'room-1', slug: 'room-1', title: 'Neighbourhood', order: 1, isLocked: 0, modelUrl: '/assets/models/neighbourhood.glb' };
          }
          if (sql.includes('FROM items')) {
            return { id: 'item-1', type: 'pdf', r2_key: 'rooms/room-1/items/item-1/file.pdf' };
          }
          return null;
        },
        async run() {
          return { ok: true };
        }
      };
    }
  },
  PUBLIC_R2_BASE: 'https://example.cdn/'
};

async function run() {
  {
    const res = await worker.fetch(new Request('http://local/api/rooms', { method: 'GET' }), env);
    const json = await res.json();
    console.log('GET /api/rooms =>', json);
  }
  {
    const res = await worker.fetch(new Request('http://local/api/rooms/room-1', { method: 'GET' }), env);
    const json = await res.json();
    console.log('GET /api/rooms/room-1 =>', json.room?.title, 'items:', json.items?.length);
  }
  {
    const res = await worker.fetch(new Request('http://local/api/items/item-1/media', { method: 'GET' }), env);
    const json = await res.json();
    console.log('GET /api/items/item-1/media =>', json.url);
  }
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
