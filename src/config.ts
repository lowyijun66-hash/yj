// src/config.ts
export const AppConfig = {
  storage: {
    r2: {
      bucketName: 'portfolio-assets',
      publicUrl:
        (typeof import.meta !== 'undefined' &&
          import.meta.env &&
          import.meta.env.VITE_PUBLIC_R2_BASE) ||
        'https://pub-784f804eae814ced8bd402fd02b5d92f.r2.dev',
    },
  },
  database: {
    // Database config removed as we are using Cloudflare D1 via Worker API
  },
};
