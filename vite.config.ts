import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function healthEndpoint() {
  const handler = (req: any, res: any, next: () => void) => {
    if (req.url?.split('?')[0] !== '/api/health' || req.method !== 'HEAD') return next()
    res.statusCode = 204
    res.setHeader('Cache-Control', 'no-store')
    res.end()
  }
  return {
    name: 'service-request-health',
    configureServer(server: any) { server.middlewares.use(handler) },
    configurePreviewServer(server: any) { server.middlewares.use(handler) }
  }
}

export default defineConfig({ plugins: [react(), healthEndpoint()], server: { port: 5173 } })
