import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            const errCode = (err as any)?.code;
            // Suppress benign broken pipe (EPIPE) and connection reset (ECONNRESET)
            // when client tab reloads, closes, or aborts requests
            if (errCode === 'EPIPE' || errCode === 'ECONNRESET') {
              return;
            }
            console.error('Vite proxy error:', err);
            try {
              const response = res as any;
              if (response && !response.headersSent && typeof response.writeHead === 'function') {
                response.writeHead(502, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'Backend service unavailable', code: errCode }));
              }
            } catch {}
          });
        }
      }
    }
  }
})
