import { loadEnvFile } from 'node:process'
import { buildApp } from './app.js'
import { createServerBanner } from './lib/server-banner.js'

try {
  loadEnvFile()
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
}

const app = await buildApp()
const port = Number(process.env.PORT ?? 4000)
const host = process.env.HOST ?? '0.0.0.0'

try {
  await app.listen({ host, port })
  if (process.env.NODE_ENV !== 'production') {
    const address = app.server.address()
    const listeningPort = address && typeof address === 'object' ? address.port : port
    console.log(createServerBanner(host, listeningPort))
  }
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
