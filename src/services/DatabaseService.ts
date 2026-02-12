
export class DatabaseService {
  
  constructor() {
    // No initialization needed for REST API
  }

  async getHubData() {
    try {
      const res = await fetch('/api/hub');
      if (!res.ok) throw new Error(`Failed to fetch hub data: ${res.status}`);
      const data = await res.json();
      
      // API returns { doors: [{id, roomId, label, position, rotation, scale}], modelUrl }
      // This matches what the app expects, so no complex transformation needed.
      return data;
    } catch (e) {
      console.warn("Hub data fetch failed", e);
      return { doors: [] };
    }
  }

  async getRoomsData() {
    try {
      const res = await fetch('/api/rooms');
      if (!res.ok) throw new Error(`Failed to fetch rooms: ${res.status}`);
      const data = await res.json();
      // API returns { rooms: [...] }
      // We might need to fetch items for each room if this view expects full tree.
      // The Admin Console expects `roomsData` to contain rooms AND their items?
      // Let's check console/index.html.
      // It iterates `roomsData.rooms`.
      // When selecting a room, it uses `currentData` which is a reference to a room object.
      // If the initial load only gets room metadata, we might miss items.
      // `GET /api/rooms` only returns metadata.
      
      // We should probably fetch full details for all rooms for the Admin Console "Load" or "Export" feature.
      // Or, we can lazy load items. But the current architecture (legacy JSON) loaded everything at once.
      // To mimic that and "eliminate JSON fallback", we should fetch everything.
      
      const rooms = data.rooms || [];
      for (const room of rooms) {
        // Fetch items for this room
        const itemRes = await fetch(`/api/rooms/${room.slug}/items`);
        if (itemRes.ok) {
           const itemData = await itemRes.json();
           room.items = itemData.items.map((i: any) => ({
             ...i,
             // Map snake_case to camelCase
             mediaUrl: i.media_url,
             objectiveText: i.objective_text,
             transform: typeof i.transform === 'string' ? JSON.parse(i.transform) : i.transform,
             // Ensure position/rotation/scale exist on item root for compatibility if needed
             position: (typeof i.transform === 'string' ? JSON.parse(i.transform) : i.transform)?.position,
             rotation: (typeof i.transform === 'string' ? JSON.parse(i.transform) : i.transform)?.rotation,
             scale: (typeof i.transform === 'string' ? JSON.parse(i.transform) : i.transform)?.scale
           }));
        } else {
           room.items = [];
        }
      }
      
      return { rooms };
    } catch (e) {
      console.warn("Rooms data fetch failed", e);
      return { rooms: [] };
    }
  }

  async saveHubData(hubData: any) {
    // hubData is { doors: [...] }
    const res = await fetch('/api/admin/hub', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hubData)
    });
    if (!res.ok) throw new Error(`Failed to save hub data: ${res.status}`);
  }

  async saveRoomsData(roomsData: any) {
    // roomsData is { rooms: [...] }
    // We need to iterate and save each room and its items.
    
    for (const room of roomsData.rooms) {
      // 1. Save Room Metadata
      const roomPayload = {
        id: room.id,
        slug: room.slug || (room.name ? room.name.toLowerCase().replace(/\s+/g, '-') : 'room'),
        title: room.name || room.title,
        order: room.order,
        isLocked: room.isLocked,
        modelUrl: room.modelUrl
      };
      
      const rRes = await fetch('/api/admin/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roomPayload)
      });
      if (!rRes.ok) console.error(`Failed to save room ${room.id}`, await rRes.text());
      
      // 2. Save Items
      if (room.items && room.items.length > 0) {
        for (const item of room.items) {
          const itemPayload = {
            id: item.id,
            room_id: room.id,
            title: item.title || item.label,
            type: item.type,
            media_url: item.mediaUrl,
            transform: {
              position: item.position,
              rotation: item.rotation,
              scale: item.scale
            },
            isObjective: !!item.isObjective,
            objective_text: item.objectiveText
          };
          
          const iRes = await fetch('/api/admin/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemPayload)
          });
          if (!iRes.ok) console.error(`Failed to save item ${item.id}`, await iRes.text());
        }
      }
    }
  }
}
