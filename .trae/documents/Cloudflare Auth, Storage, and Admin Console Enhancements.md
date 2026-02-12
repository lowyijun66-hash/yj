## Overview
- Replace client-side password with Cloudflare-managed auth; remove any secrets from code.
- Make per-room item counts fully data-driven; items can be PDFs, videos, images, links.
- Add upload and metadata management in the admin console; store files in Cloudflare R2, metadata in Cloudflare D1.
- Decouple display titles (rooms, items, objectives) from file names; editable in admin console.

## Authentication (Cloudflare Access)
- Protect /console and all /api/admin/* routes with Cloudflare Access; no password stored client-side.
- Worker validates CF-Access-JWT-Assertion against Access certs and extracts user identity.
- Remove sessionStorage password gate in the console UI and rely on Access.
- Optional: role checks inside Worker using Access groups.

## Storage (Cloudflare R2)
- Use a single R2 bucket for all media.
- Object key scheme:
  - rooms/{room_slug}/items/{item_uuid}/{original_filename}
  - For HLS videos: rooms/{room_slug}/items/{item_uuid}/hls/index.m3u8
- Upload flow:
  - Admin requests a presigned URL from Worker; browser uploads directly to R2.
  - Worker stores final object key in D1 with associated item metadata.
- Delivery:
  - For PDFs/images: signed read URLs or Worker streaming with proper Content-Type.
  - For videos: serve HLS playlist via Worker; set CORS for media origins.

## Data Model (Cloudflare D1)
- rooms: id, slug, title, position/order, isLocked
- items: id, room_id, title, type (pdf|video|image|link), r2_key, media_url (optional), transform (x/y/z/rot/scale), isObjective, objective_text
- objectives: id, room_id, title, description, item_id (nullable), sequence_order
- progress (optional, client-only for now): localStorage per room; future upgrade to D1 per user if needed.
- Migrations: initialize D1 schema and seed from existing JSON ([rooms.json], [hub.json]).

## Admin Console Changes
- Rooms panel:
  - Create/rename rooms (title independent from slug and file names).
  - Order rooms and lock/unlock state.
- Items panel:
  - Add/remove items; set title, type, objective_text, isObjective.
  - Upload media via presigned URL; show upload status and preview.
  - Position/rotate/scale items in 3D scene; save transform to D1.
- Objectives panel:
  - Define per-room objective list and sequence; allow linking to an item.
- Save/Publish:
  - Persist changes to D1; on publish, validate references and generate cache-busting revision.

## Walkthrough / Gameplay Changes
- Hub and room pages fetch room and item data from Worker API.
- Interaction:
  - Clicking an item opens a modal viewer (PDF/video/image) with controls.
  - Closing viewer updates local progress and shows next objective prompt.
  - When all objectives in a room are complete, auto-return prompt to main hub.
- Variable item count:
  - Render interactiveObjects from items list; raycast and prompt dynamically.

## API (Cloudflare Worker)
- Public:
  - GET /api/rooms
  - GET /api/rooms/:slug
  - GET /api/rooms/:slug/items
  - GET /api/items/:id/media (streams or returns signed URL)
- Admin (Access-protected):
  - POST /api/admin/rooms (create/update)
  - POST /api/admin/items (create/update)
  - DELETE /api/admin/items/:id
  - POST /api/admin/upload-url (returns presigned PUT/POST to R2)
  - POST /api/admin/publish (optional cache bust)

## Bucket Management & CORS
- Enable CORS for GET on the R2 public endpoint to allow media viewing; restrict PUT to presigned requests only.
- Naming and lifecycle:
  - Keep human-readable titles in D1, not in object keys.
  - On item delete, Worker removes R2 objects and D1 rows.
  - Optional retention lifecycle for unused uploads.

## Security & Privacy
- No passwords or secrets in client code; Workers use environment bindings for R2 and D1.
- Validate Access JWT on every admin API call.
- Signed URLs expire quickly; viewer requests fetch fresh tokens.
- Content-Type and download headers set correctly; PDFs open inline, videos use HLS.

## Migration & Rollout
- Step 1: Introduce Worker with read-only public endpoints to replace JSON fetches.
- Step 2: Gate /console with Cloudflare Access; remove client password logic.
- Step 3: Add D1 schema and data migration from existing JSON.
- Step 4: Implement presigned upload and admin item/room editing.
- Step 5: Replace direct asset paths with Worker-provided URLs; add modal viewers.

## Testing & Verification
- Unit tests for Worker endpoints and Access validation.
- Integration tests for admin upload and D1 persistence.
- Manual end-to-end: create a room, upload PDF and video, set objectives, verify gameplay flow.

## Notes & Current Code References
- Insecure password gate currently in client: login and console pages.
- R2 upload script exists; will be replaced by presigned flow.
- Storage service interface exists; will be implemented to call Worker endpoints and manage uploads.