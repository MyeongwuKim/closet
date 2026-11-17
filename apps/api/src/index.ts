import { loadEnvFile } from 'node:process'
import { buildApp } from './app.js'
import { ensureAiStorage } from './lib/ai/ai-storage.js'
import { createSharedAiExecutor } from './lib/ai/shared-ai-executor.js'
import { installAiExecutor } from './lib/ai/ai-execution.js'
import { startPreviewWorker } from './features/outfit/preview-job.worker.js'
import { createServerBanner } from './lib/server-banner.js'
import { startWearWeatherWorker } from './features/planner/wear-weather.service.js'
import { ensureWearWeatherStorage } from './features/planner/wear-weather.repository.js'
import { startRediscoveryPushWorker } from './features/push/rediscovery-push.service.js'
import { ensureAccountImageCleanupStorage } from './features/user/account-image-cleanup.repository.js'
import { startAccountImageCleanupWorker } from './features/user/account-image-cleanup.worker.js'

try {
  loadEnvFile()
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
}

// 저장소와 인덱스 준비가 실패하면 메모리 제한으로 우회하지 않고 시작을 중단한다.
await ensureAiStorage()
await ensureWearWeatherStorage()
await ensureAccountImageCleanupStorage()
installAiExecutor(createSharedAiExecutor())
const app = await buildApp()
let stopPreviewWorker: (() => Promise<void>) | undefined
let stopWearWeatherWorker: (() => Promise<void>) | undefined
let stopRediscoveryPushWorker: (() => Promise<void>) | undefined
let stopAccountImageCleanupWorker: (() => Promise<void>) | undefined
app.addHook('onClose', async () => { await Promise.all([stopPreviewWorker?.(), stopWearWeatherWorker?.(), stopRediscoveryPushWorker?.(), stopAccountImageCleanupWorker?.()]) })
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void app.close().then(() => process.exit(0)) })
}
const port = Number(process.env.PORT ?? 4000)
const host = process.env.HOST ?? '0.0.0.0'

try {
  await app.listen({ host, port })
  stopPreviewWorker = startPreviewWorker()
  stopWearWeatherWorker = startWearWeatherWorker()
  stopRediscoveryPushWorker = startRediscoveryPushWorker()
  stopAccountImageCleanupWorker = startAccountImageCleanupWorker()
  if (process.env.NODE_ENV !== 'production') {
    const address = app.server.address()
    const listeningPort = address && typeof address === 'object' ? address.port : port
    console.log(createServerBanner(host, listeningPort))
  }
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
