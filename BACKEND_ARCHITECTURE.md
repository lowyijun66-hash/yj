# Backend & Storage Architecture for Global + China Accessibility

## Overview
To ensure fast and reliable access for users in both China and the rest of the world, we use a **Multi-Cloud Strategy (Option C)**. This avoids the latency of accessing global servers from China (Great Firewall issues) and the latency of accessing China servers from the West.

## Architecture

```
[Admin Console] --(Upload)--> [Primary Storage (AWS S3)] --(Replication)--> [China Storage (Alibaba OSS)]
                                      |                                           |
                                      v                                           v
[Global Users] <--(CloudFront)--> [AWS S3]                                [Alibaba CDN] <--(China Users)
```

## Storage Strategy

### 1. Global Storage (AWS S3 + CloudFront)
- **Bucket:** `vhs-portfolio-global`
- **Region:** `us-east-1` (or nearest to you)
- **CDN:** AWS CloudFront
- **Purpose:** Serves all users outside Mainland China.

### 2. China Storage (Alibaba Cloud OSS + CDN)
- **Bucket:** `vhs-portfolio-cn`
- **Region:** `oss-cn-shanghai` (or Beijing/Shenzhen)
- **CDN:** Alibaba Cloud CDN
- **Purpose:** Serves users inside Mainland China with low latency and high reliability.
- **Requirement:** Requires an ICP Filing (Bei'an) if hosted on a domain resolving to China servers.

## Asset Management (GLB & Video)

### File Upload Flow
1. **Admin Console Upload:**
   - The Admin Console will request a **Presigned URL** from the Backend API.
   - Browser uploads the `.glb` or `.mp4` file directly to the Primary S3 Bucket.
   - *No server bottleneck during upload.*

2. **Replication (Sync):**
   - **Option A (Automated):** Use an AWS Lambda function triggered by S3 uploads to copy files to Alibaba OSS.
   - **Option B (Manual/Tool):** Use `rclone` or a custom script to sync buckets periodically.

### Video Optimization
- **Problem:** MP4 files can be slow to load.
- **Solution:** Use **HLS (HTTP Live Streaming)**.
- **Process:**
  - Upload `.mp4` to S3.
  - AWS MediaConvert (or Lambda + FFmpeg) converts it to `.m3u8` playlist and `.ts` chunks.
  - Sync these chunks to Alibaba OSS.
  - The website player (e.g., `video.js`) picks the best resolution automatically.

## Frontend Logic (Smart Routing)

The website will detect the user's region or use a DNS-based traffic manager (like AWS Route53 Geolocation Routing) to serve the correct asset domain.

```javascript
const isChina = userRegion === 'CN'; // Detected via IP or selected language
const baseUrl = isChina ? 'https://cdn.my-site.cn/assets/' : 'https://assets.my-site.com/';

// Loading a model
loader.load(baseUrl + 'models/room1.glb', ...);
```

## Folder Structure (Recommended)

```
/
├── public/
│   ├── assets/
│   │   ├── models/       # .glb files
│   │   ├── videos/       # .mp4 / .m3u8
│   │   ├── textures/
│   │   └── audio/
│   └── data/
│       ├── rooms.json    # Room definitions
│       └── hub.json      # Hub configuration
├── admin/                # Admin Console (Frontend)
└── src/                  # Source code
```
