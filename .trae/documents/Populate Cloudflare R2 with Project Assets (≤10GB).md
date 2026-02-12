## Changes Requested
- Do not treat retro_vhs_tape_game_ready.glb as Room 2.
- Remove that model from upload targets and from the project’s room configuration.

## Actions (No Secrets Committed)
- R2 Upload: Only upload models/neighbourhood.glb (Room 1) and models/cassette_tape.glb (mission item). Skip models/retro_vhs_tape_game_ready.glb.
- Project Config Update:
  - Update public/data/rooms.json to remove or repurpose Room 2 so it no longer references retro_vhs_tape_game_ready.glb.
  - Sync hub doors after the room list changes (Admin Console already supports door sync).
- Keep hub excluded from uploads; keep audio/video/fonts local.

## Bucket & Access
- Endpoint: https://f1800f13536872f331fd2a7733487b03.r2.cloudflarestorage.com
- Bucket: vhs-portfolio-assets
- Public access enabled; CORS allow GET from localhost:5173 and production domain.

## App Configuration
- Set ASSET_BASE in public/js/config.js to your R2 public domain
- Continue to use CONFIG.resolveAsset for rooms and items so JSON resolves to R2

## Verification
- Confirm R2 URLs for neighbourhood.glb and cassette_tape.glb load publicly
- Open Admin Console and Walkthrough to ensure Room 1 and mission item render
- Ensure no references remain to retro_vhs_tape_game_ready.glb