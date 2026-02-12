// Abstract interface for any storage provider
export interface IStorageProvider {
  uploadFile(file: File, path: string): Promise<string>;
  deleteFile(path: string): Promise<void>;
  getPublicUrl(path: string): string;
}

// Configuration for our providers
export interface StorageConfig {
  r2?: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    publicUrl: string;
  };
  aliyun?: {
    region: string;
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
  };
}

export class StorageService {
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  /**
   * Uploads a file to the configured providers.
   * Uses Cloudflare Worker admin presigned upload when available; falls back to mock.
   */
  async upload(file: File, folder: 'models' | 'videos' | 'images', opts?: { roomSlug?: string; itemId?: string }): Promise<{ globalUrl: string }> {
    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const path = `${folder}/${fileName}`;

    console.log(`[Storage] Starting upload for ${path}...`);

    // Try Worker-provided presigned upload
    const globalUrl = await this.tryWorkerPresigned(file, path, opts) || await this.mockUpload(file, path, 'Global (R2)');

    return {
      globalUrl,
    };
  }

  private async tryWorkerPresigned(file: File, path: string, opts?: { roomSlug?: string; itemId?: string }): Promise<string | null> {
    try {
      const res = await fetch('/api/admin/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          roomSlug: opts?.roomSlug || 'room',
          itemId: opts?.itemId || 'temp',
          filename: path.split('/').pop(),
          contentType: file.type || 'application/octet-stream'
        })
      });
      if (!res.ok) return null;
      const { key, url } = await res.json();
      if (!url) return null;
      // If real presigned URL, perform PUT
      if (typeof url === 'string' && /^https?:\/\//.test(url)) {
        const put = await fetch(url, { method: 'PUT', headers: { 'content-type': file.type || 'application/octet-stream' }, body: file });
        if (!put.ok) throw new Error(`Upload failed: ${put.status}`);
        // Return public base + key if available
        return this.config?.r2?.publicUrl ? `${this.config.r2.publicUrl.replace(/\/+$/, '')}/${key}` : key;
      }
      // Unknown scheme; fall back to mock
      return null;
    } catch (e) {
      console.warn('Presigned upload not available, falling back to mock:', e);
      return null;
    }
  }

  private async mockUpload(file: File, path: string, providerName: string): Promise<string> {
    return new Promise((resolve) => {
      console.log(`[${providerName}] Uploading ${file.size} bytes...`);
      setTimeout(() => {
        console.log(`[${providerName}] Upload complete.`);
        // Return a fake URL for now
        resolve(`https://mock-storage.com/${providerName.toLowerCase().replace(/ /g,'-')}/${path}`);
      }, 1000);
    });
  }
}
