export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Routing
    if (path.startsWith("/api/admin/")) {
      // Access-protected admin routes
      const user = await validateAccess(request);
      if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders() });
      return handleAdmin(request, env);
    }

    if (path.startsWith("/api/")) {
      return handlePublic(request, env);
    }

    return new Response("OK");
  }
};

function jsonHeaders(extra = {}) {
  return { "content-type": "application/json; charset=utf-8", ...extra };
}

async function validateAccess(request) {
  try {
    const jwt = request.headers.get("cf-access-jwt-assertion");
    if (!jwt) return null;
    const certsRes = await fetch("https://cflare.com/cdn-cgi/access/certs");
    if (!certsRes.ok) return null;
    const { keys } = await certsRes.json();
    const verified = await verifyJwt(jwt, keys);
    return verified ? verified.email || verified.sub || "user" : null;
  } catch {
    return null;
  }
}

async function ensureSchema(env) {
  if (!env.DB) return;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL, `order` INTEGER DEFAULT 0, isLocked INTEGER DEFAULT 0, modelUrl TEXT DEFAULT '')"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, title TEXT DEFAULT '', type TEXT NOT NULL, r2_key TEXT DEFAULT '', media_url TEXT DEFAULT '', transform TEXT DEFAULT '{}', isObjective INTEGER DEFAULT 0, objective_text TEXT DEFAULT '', created_at INTEGER DEFAULT (strftime('%s','now')))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS doors (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, transform TEXT DEFAULT '{}', label TEXT DEFAULT '')"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS hub_settings (id TEXT PRIMARY KEY, modelUrl TEXT DEFAULT '')"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS objectives (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT DEFAULT '', item_id TEXT, sequence_order INTEGER DEFAULT 0)")
  ]);
}

async function handlePublic(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  await ensureSchema(env);

  // GET /api/rooms
  if (method === "GET" && path === "/api/rooms") {
    // Placeholder D1 query
    if (!env.DB) {
      return new Response(JSON.stringify({ rooms: [] }), { headers: jsonHeaders() });
    }
    const { results } = await env.DB.prepare("SELECT id, slug, title, `order`, isLocked, modelUrl FROM rooms ORDER BY `order` ASC").all();
    return new Response(JSON.stringify({ rooms: results || [] }), { headers: jsonHeaders() });
  }

  // GET /api/hub (Doors + Settings)
  if (method === "GET" && path === "/api/hub") {
    if (!env.DB) return new Response(JSON.stringify({ doors: [], modelUrl: '' }), { headers: jsonHeaders() });
    const doorsResult = await env.DB.prepare("SELECT doors.*, rooms.slug as room_slug FROM doors LEFT JOIN rooms ON doors.room_id = rooms.id").all();
    const settingsResult = await env.DB.prepare("SELECT modelUrl FROM hub_settings WHERE id = 'main'").first();
    
    const doors = (doorsResult.results || []).map(d => {
        let trans = {};
        try { trans = JSON.parse(d.transform || '{}'); } catch {}
        return {
            id: d.id,
            roomId: d.room_slug || d.room_id,
            label: d.label,
            position: trans.position || {x:0,y:0,z:0},
            rotation: trans.rotation || {x:0,y:0,z:0},
            scale: trans.scale || {x:1,y:1,z:1}
        };
    });

    return new Response(JSON.stringify({ 
        doors: doors,
        modelUrl: settingsResult ? settingsResult.modelUrl : ''
    }), { headers: jsonHeaders() });
  }

  // GET /api/rooms/:slug
  const roomSlugMatch = path.match(/^\/api\/rooms\/([^\/]+)$/);
  if (method === "GET" && roomSlugMatch) {
    const slug = roomSlugMatch[1];
    if (!env.DB) return new Response(JSON.stringify({ room: null, items: [] }), { headers: jsonHeaders() });
    const room = await env.DB.prepare("SELECT id, slug, title, `order`, isLocked, modelUrl FROM rooms WHERE slug = ?").bind(slug).first();
    if (!room) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: jsonHeaders() });
    const { results: items } = await env.DB.prepare("SELECT * FROM items WHERE room_id = ? ORDER BY created_at ASC").bind(room.id).all();
    return new Response(JSON.stringify({ room, items: items || [] }), { headers: jsonHeaders() });
  }

  // GET /api/rooms/:slug/items
  const roomItemsMatch = path.match(/^\/api\/rooms\/([^\/]+)\/items$/);
  if (method === "GET" && roomItemsMatch) {
    const slug = roomItemsMatch[1];
    if (!env.DB) return new Response(JSON.stringify({ items: [] }), { headers: jsonHeaders() });
    const room = await env.DB.prepare("SELECT id FROM rooms WHERE slug = ?").bind(slug).first();
    if (!room) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: jsonHeaders() });
    const { results: items } = await env.DB.prepare("SELECT * FROM items WHERE room_id = ?").bind(room.id).all();
    return new Response(JSON.stringify({ items: items || [] }), { headers: jsonHeaders() });
  }

  // GET /api/items/:id/media
  const mediaMatch = path.match(/^\/api\/items\/([^\/]+)\/media$/);
  if (method === "GET" && mediaMatch) {
    const id = mediaMatch[1];
    if (!env.DB) return new Response(JSON.stringify({ url: null }), { headers: jsonHeaders() });
    const item = await env.DB.prepare("SELECT id, type, r2_key FROM items WHERE id = ?").bind(id).first();
    if (!item) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: jsonHeaders() });

    // Generate a short-lived signed URL via R2 (S3-compatible)
    // if (!env.R2) return new Response(JSON.stringify({ url: null }), { headers: jsonHeaders() });
    const signed = await createSignedReadUrl(env, item.r2_key, 5 * 60);
    return new Response(JSON.stringify({ url: signed }), { headers: jsonHeaders({ "cache-control": "no-store" }) });
  }

  return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: jsonHeaders() });
}

async function handleAdmin(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  await ensureSchema(env);

  // POST /api/admin/upload-url
  if (method === "POST" && path === "/api/admin/upload-url") {
    if (!env.R2) return new Response(JSON.stringify({ error: "R2 not bound" }), { status: 500, headers: jsonHeaders() });
    const body = await request.json();
    const { roomSlug, itemId, filename, contentType } = body;
    const key = `rooms/${roomSlug}/items/${itemId}/${filename}`;
    const url = await createSignedPutUrl(env, key, contentType, 10 * 60);
    return new Response(JSON.stringify({ key, url }), { headers: jsonHeaders({ "cache-control": "no-store" }) });
  }

  // POST /api/admin/rooms
  if (method === "POST" && path === "/api/admin/rooms") {
    if (!env.DB) return new Response(JSON.stringify({ error: "DB not bound" }), { status: 500, headers: jsonHeaders() });
    const body = await request.json();
    const { id, slug, title, order, isLocked, modelUrl } = body;
    if (id) {
      await env.DB.prepare("UPDATE rooms SET slug=?, title=?, `order`=?, isLocked=?, modelUrl=? WHERE id=?")
        .bind(slug, title, order ?? 0, isLocked ? 1 : 0, modelUrl ?? "", id)
        .run();
      return new Response(JSON.stringify({ ok: true, id }), { headers: jsonHeaders() });
    } else {
      const newId = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO rooms(id, slug, title, `order`, isLocked, modelUrl) VALUES(?,?,?,?,?,?)")
        .bind(newId, slug, title, order ?? 0, isLocked ? 1 : 0, modelUrl ?? "")
        .run();
      return new Response(JSON.stringify({ ok: true, id: newId }), { headers: jsonHeaders() });
    }
  }

  // POST /api/admin/hub (Doors + Settings)
  if (method === "POST" && path === "/api/admin/hub") {
    if (!env.DB) return new Response(JSON.stringify({ error: "DB not bound" }), { status: 500, headers: jsonHeaders() });
    const body = await request.json();
    const { doors, modelUrl } = body;
    
    const statements = [];
    
    // 1. Save Hub Settings
    if (typeof modelUrl !== 'undefined') {
        statements.push(
            env.DB.prepare("INSERT INTO hub_settings(id, modelUrl) VALUES('main', ?) ON CONFLICT(id) DO UPDATE SET modelUrl=excluded.modelUrl")
                .bind(modelUrl)
        );
    }
    
    // 2. Save Doors
    if (Array.isArray(doors)) {
        const stmt = env.DB.prepare("INSERT INTO doors(id, room_id, transform, label) VALUES(?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET room_id=excluded.room_id, transform=excluded.transform, label=excluded.label");
        doors.forEach(d => {
             // Construct transform from flat props if needed
             const transformObj = d.transform || {
                 position: d.position || {x:0,y:0,z:0},
                 rotation: d.rotation || {x:0,y:0,z:0},
                 scale: d.scale || {x:1,y:1,z:1}
             };

             statements.push(stmt.bind(
                d.id, 
                d.roomId || d.room_id, 
                JSON.stringify(transformObj), 
                d.label || ''
            ));
        });
    }
    
    if (statements.length > 0) {
        await env.DB.batch(statements);
        return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders() });
    }
    
    return new Response(JSON.stringify({ error: "No data provided" }), { status: 400, headers: jsonHeaders() });
  }

  // POST /api/admin/items
  if (method === "POST" && path === "/api/admin/items") {
    if (!env.DB) return new Response(JSON.stringify({ error: "DB not bound" }), { status: 500, headers: jsonHeaders() });
    const body = await request.json();
    const { id, room_id, title, type, r2_key, media_url, transform, isObjective, objective_text } = body;
    if (id) {
      await env.DB.prepare("UPDATE items SET room_id=?, title=?, type=?, r2_key=?, media_url=?, transform=?, isObjective=?, objective_text=? WHERE id=?")
        .bind(room_id, (title ?? ''), type, (r2_key ?? ""), (media_url ?? ""), JSON.stringify(transform ?? {}), isObjective ? 1 : 0, (objective_text ?? ""), id)
        .run();
      return new Response(JSON.stringify({ ok: true, id }), { headers: jsonHeaders() });
    } else {
      const newId = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO items(id, room_id, title, type, r2_key, media_url, transform, isObjective, objective_text) VALUES(?,?,?,?,?,?,?,?,?)")
        .bind(newId, room_id, (title ?? ''), type, (r2_key ?? ""), (media_url ?? ""), JSON.stringify(transform ?? {}), isObjective ? 1 : 0, (objective_text ?? ""))
        .run();
      return new Response(JSON.stringify({ ok: true, id: newId }), { headers: jsonHeaders() });
    }
  }

  // DELETE /api/admin/rooms/:id
  const delRoomMatch = path.match(/^\/api\/admin\/rooms\/([^\/]+)$/);
  if (method === "DELETE" && delRoomMatch) {
    if (!env.DB) return new Response(JSON.stringify({ error: "DB not bound" }), { status: 500, headers: jsonHeaders() });
    const id = delRoomMatch[1];
    await env.DB.prepare("DELETE FROM rooms WHERE id=?").bind(id).run();
    return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders() });
  }

  // DELETE /api/admin/items/:id
  const delMatch = path.match(/^\/api\/admin\/items\/([^\/]+)$/);
  if (method === "DELETE" && delMatch) {
    if (!env.DB) return new Response(JSON.stringify({ error: "DB not bound" }), { status: 500, headers: jsonHeaders() });
    const id = delMatch[1];
    await env.DB.prepare("DELETE FROM items WHERE id=?").bind(id).run();
    return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders() });
  }

  return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: jsonHeaders() });
}

async function verifyJwt(jwt, keys) {
  // Minimal JWT verification placeholder: ensure header.alg=RS256 and exp not passed.
  // For production, use complete validation with cert lookup.
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

async function createSignedReadUrl(env, key, ttlSeconds) {
  // Placeholder: When using R2 signed URLs via S3 compatibility, a separate signing service is needed.
  // For now, return a public-style URL if configured via binding.
  if (env.PUBLIC_R2_BASE) {
    const u = new URL(env.PUBLIC_R2_BASE);
    u.pathname = [u.pathname.replace(/\/+$/, ""), key].join("/");
    return u.toString();
  }
  return null;
}

async function createSignedPutUrl(env, key, contentType, ttlSeconds) {
  // Placeholder: generate an upload URL via R2 S3-compatible signature in another service.
  // For now, return a presigned-like opaque URL indicating key; client will fall back to direct upload script in dev.
  return `r2+presigned://upload/${encodeURIComponent(key)}?contentType=${encodeURIComponent(contentType || "application/octet-stream")}&ttl=${ttlSeconds}`;
}
