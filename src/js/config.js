// Central Configuration for the App
// Import this in your HTML files

export const CONFIG = {
  // The base URL for your Cloudflare R2 bucket.
  // Option A: Custom Domain (Recommended for China) -> 'https://assets.yourdomain.com/'
  // Option B: Default R2 Managed Public URL -> 'https://pub-xxxxxxxx.r2.dev/'
  ASSET_BASE:
    (typeof import.meta !== 'undefined' &&
      import.meta.env &&
      import.meta.env.VITE_PUBLIC_R2_BASE) ||
    'https://pub-784f804eae814ced8bd402fd02b5d92f.r2.dev/',

  // Helper to resolve asset URLs
  resolveAsset: function(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url; // Already absolute
    
    // IF it's a model that should remain local (like the hub), return relative path
    // NOTE: This logic depends on specific filenames or folder structures
    if (url.includes('backrooms_again.glb') || url.includes('door.glb')) {
       // Ensure it starts with /assets/ to be absolute relative to domain root
       if (!url.startsWith('/assets') && !url.startsWith('/')) {
         if (url.startsWith('assets')) return '/' + url;
         return '/assets/' + url;
       }
       return url;
    }

    // Treat any /assets/* path as local
    if (url.startsWith('/assets/')) return url;
    if (url.startsWith('assets/')) return '/' + url;

    // Clean up path
    let path = url;
    if (path.startsWith('../public/assets/')) path = path.replace('../public/assets/', '');
    else if (path.startsWith('public/assets/')) path = path.replace('public/assets/', '');
    else if (path.startsWith('./')) path = path.substring(2);
    else if (path.startsWith('/')) path = path.substring(1);
    
    // Combine with base
    return this.ASSET_BASE + path;
  }
};
