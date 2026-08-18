import { loadEnvFile } from 'node:process'
import { buildApp } from './app.js'

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
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
