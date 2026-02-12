import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    {
      name: 'configure-server',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Normalize URL to ignore query strings for the check
          const url = req.url.split('?')[0];
          const dirs = ['/login', '/console', '/walkthrough', '/walkthrough/room-1'];
          
          if (dirs.includes(url)) {
            // Redirect to the same URL with a trailing slash
            // Use 302 for temporary redirect to avoid browser caching issues during dev
            res.writeHead(302, { Location: req.url.replace(url, url + '/') });
            res.end();
            return;
          }
          next();
        });
      },
    },
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login/index.html'),
        console: resolve(__dirname, 'console/index.html'),
        walkthrough: resolve(__dirname, 'walkthrough/index.html'),
        room1: resolve(__dirname, 'walkthrough/room-1/index.html')
      }
    }
  }
});
