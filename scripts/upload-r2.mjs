
import 'dotenv/config';
import { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import mime from "mime-types";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET_NAME = "portfolio-assets";

if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
  console.error("Error: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables are required.");
  process.exit(1);
}

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

function getFilesRecursively(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(getFilesRecursively(file));
    } else { 
      results.push(file);
    }
  });
  return results;
}

async function getAssetsToUpload() {
  const assetsDir = path.resolve(__dirname, "../public/assets");
  
  // Recursive file search
  const allFiles = getFilesRecursively(assetsDir);
  
  // Filter for relevant extensions
  const relevantExtensions = ['.glb', '.mp3', '.mp4', '.ttf'];
  const files = allFiles.filter(file => relevantExtensions.includes(path.extname(file).toLowerCase()));
  
  return files.map(file => {
    // local path (absolute)
    const local = file;
    
    // remote path: relative to assets/ folder
    // e.g. C:\...\public\assets\models\foo.glb -> models/foo.glb
    let relativePath = path.relative(assetsDir, file);
    
    // Normalize path separators to forward slashes for S3
    const remote = relativePath.replace(/\\/g, '/');
    
    return { local, remote };
  });
}

async function ensureBucket() {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`Bucket '${BUCKET_NAME}' exists.`);
  } catch (error) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      console.log(`Bucket '${BUCKET_NAME}' not found. Creating...`);
      await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
      console.log(`Bucket '${BUCKET_NAME}' created.`);
    } else {
      throw error;
    }
  }
}

async function uploadFile(localPath, remotePath) {
  if (!fs.existsSync(localPath)) {
    console.warn(`Skipping missing file: ${localPath}`);
    return;
  }

  const fileContent = fs.readFileSync(localPath);
  const contentType = mime.lookup(localPath) || "application/octet-stream";

  console.log(`Uploading ${remotePath} (${(fileContent.length / 1024 / 1024).toFixed(2)} MB)...`);

  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: remotePath,
    Body: fileContent,
    ContentType: contentType,
  }));

  console.log(`✅ Uploaded: ${remotePath}`);
}

async function main() {
  try {
    console.log("Starting R2 Upload...");
    await ensureBucket();

    const assets = await getAssetsToUpload();
    console.log(`Found ${assets.length} assets to upload.`);

    for (const asset of assets) {
      await uploadFile(asset.local, asset.remote);
    }

    console.log("All uploads complete!");
    console.log(`Verify at: https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET_NAME}/models/backrooms_again.glb`);

  } catch (err) {
    console.error("Upload failed:", err);
    process.exit(1);
  }
}

main();
