**Overview**

* Implement hub/rooms architecture with progressive door unlocking and item objectives.

* Reorganize folders for scalable content, add JSON schemas, and modularize 3D code.

* Use multi-cloud storage and CDN with geo routing: Global → AWS S3 + CloudFront, China → Alibaba OSS + Alibaba CDN.

* Build an admin console + backend API with replication pipeline to keep assets in sync across clouds.

**Multi-Cloud Delivery (Option C)**

* Domains

  * assets.example.com → GeoDNS/Load Balancer pools

    * Global Pool: CloudFront (origin: S3)

    * China Pool: Alibaba Cloud CDN (origin: OSS)

* Routing

  * Use GeoDNS or Cloudflare Load Balancer (geo steering) to route CN to Alibaba CDN and others to CloudFront.

  * Fallback logic in frontend (optional): if fetch fails or is slow, retry alternate origin.

* Replication

  * On upload, backend writes asset to primary bucket (OSS), then asynchronously mirrors to S3.

  * Keep identical paths (e.g., /models/room-1.glb) across both clouds.

  * Maintain checksums and metadata records to verify parity.

* Video Streaming

  * Transcode to HLS (m3u8 + segments) and upload the full set to both OSS and S3.

  * Configure CORS and signed URLs as needed; use same paths under /video.

* ICP Consideration

  * Mainland acceleration via Alibaba CDN typically requires ICP filing for your domain. If unavailable, route China to Alibaba CDN but expect reduced performance vs ICP-enabled domains.

**Folder Structure**

* /public

  * /index.html (landing)

  * /app.html (3D app entry)

  * /assets/{models,audio,video}

  * /data/{rooms.json, hub.json}

  * /styles, /images

* /src

  * /engine (renderer, controls, collision, loader, interaction)

  * /scenes/{hub.ts, room.ts}

  * /ui (HUD, back button)

  * /state (progress persistence)

  * /services (API client, asset base URL resolver)

* /admin

  * /index.html, /src (room editor, item placement, uploads)

**Data Model**

* rooms.json

  * rooms: \[{ id, name, order, modelUrl, items: \[{ id, type, label, position, rotation, scale, mediaUrl, objective:true }] }]

  * progression: sequential, unlockAllOnComplete: true

* hub.json

  * modelUrl

  * doors: \[{ id, roomId, position, rotation, locked:true }]

**Frontend Logic**

* AssetBaseResolver: decides base URL once at startup via a lightweight ping (or rely entirely on GeoDNS).

* Hub Scene: spawn doors from hub.json; door states reflect progress; clicking a door loads room scene.

* Room Scene: load model and items; interacting with objective item marks completion → return to hub → unlock next door; previous doors visible but disabled until all rooms done; then unlock all.

* Progress persistence: localStorage (baseline) + optional backend user progress.

**Admin Console**

* Auth (admin roles), asset uploads (GLB, MP4), presigned URLs.

* Room editor: set name, order, choose modelUrl.

* Item placement: 3D viewer to drag/place items; save JSON.

* Hub door editor: add doors, assign target rooms, set transforms, lock state.

* Publish: write rooms.json, hub.json to storage and notify clients.

**Backend (API + Storage)**

* Stack: Node.js (NestJS/Express), DB: Postgres/MySQL in HK/Singapore for cross-border performance.

* Endpoints: auth, rooms CRUD, items CRUD, doors CRUD, presigned uploads for OSS and S3, replication jobs, publish configs.

* Services: FFmpeg transcode to HLS, checksum verification, CDN cache invalidation hooks.

**Migration Plan**

1. Create /public/assets and move existing GLB/audio/video there; add /public/data with initial hub.json and rooms.json.

2. Refactor current 3D page into /app.html and modularize code under /src.

3. Implement AssetBaseResolver and loaders reading from JSON.

4. Build progressive unlocking logic and interaction system.

5. Scaffold admin console and backend API; wire presigned uploads and replication.

6. Configure GeoDNS/Load Balancer, CDN origins, CORS, and caching.

7. Populate initial content and test routing from CN and non-CN locations.

**Validation**

* Verify door gating and progression; ensure hub returns and final unlock.

* Test asset fetch to both origins; HLS playback in China.

* Admin upload → mirrored assets to both clouds; checksum parity.

**Next Steps**

* Confirm domain and DNS provider for geo routing.

* Approve folder reorg and JSON schemas.

* After approval, I will implement the reorg, scaffold modules/admin/backend, and set up multi-cloud delivery.

