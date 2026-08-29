import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const portalRoot = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(portalRoot, '..')

function currentRunManifest(): Plugin {
  return {
    name: 'current-reconstruction-run',
    configureServer(server) {
      server.middlewares.use('/run.json', (request, response) => {
        const current = path.join(repositoryRoot, '.runs', 'current', 'run.json')
        const fallback = path.join(portalRoot, 'public', 'run.json')
        try {
          const fixtureRequested = new URL(request.url || '/', 'http://localhost').searchParams.get('fixture') === '1'
          const manifest = JSON.parse(fs.readFileSync(!fixtureRequested && fs.existsSync(current) ? current : fallback, 'utf8'))
          const urls: Record<string, string | undefined> = {
            before: process.env.BEFORE_URL,
            original: process.env.ORIGINAL_URL,
            reconstruction: process.env.RECONSTRUCTION_URL,
          }
          manifest.environments = manifest.environments.map((environment: { id: string }) => ({
            ...environment,
            portal_url: urls[environment.id] || undefined,
          }))
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.setHeader('Cache-Control', 'no-store')
          response.end(`${JSON.stringify(manifest)}\n`)
        } catch (error) {
          response.statusCode = 500
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Manifest load failed' }))
        }
      })
      server.middlewares.use('/evidence/', (request, response, next) => {
        const filename = path.basename(request.url || '')
        const evidence = path.join(repositoryRoot, '.runs', 'current', 'evidence', filename)
        if (!filename || !fs.existsSync(evidence) || !fs.statSync(evidence).isFile()) {
          next()
          return
        }
        const mime = evidence.endsWith('.png') ? 'image/png'
          : evidence.endsWith('.webm') ? 'video/webm'
            : 'text/plain; charset=utf-8'
        response.setHeader('Content-Type', mime)
        response.setHeader('Cache-Control', 'no-store')
        fs.createReadStream(evidence).pipe(response)
      })
    },
  }
}

export default defineConfig({
  plugins: [currentRunManifest(), react(), tailwindcss()],
  server: {
    allowedHosts: process.env.AMP_ORB ? true : undefined,
    proxy: Object.fromEntries([
      ['before', 8101],
      ['original', 8102],
      ['reconstruction', 8103],
    ].map(([environment, port]) => {
      const prefix = `/environment/${environment}`
      return [prefix, {
        target: `http://127.0.0.1:${port}`,
        changeOrigin: false,
        headers: { 'X-Reconstruction-Prefix': prefix, 'X-Forwarded-Proto': 'https' },
        rewrite: (requestPath: string) => requestPath.slice(prefix.length) || '/',
      }]
    })),
  },
})
