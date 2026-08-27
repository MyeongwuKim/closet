import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import WebSocket from 'ws'

const nativeRoot = realpathSync(fileURLToPath(new URL('..', import.meta.url)))
const timeoutMs = 5000

async function reloadApp(port) {
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('Metro 포트는 1~65535 사이의 숫자로 지정해주세요.')
  }

  const serverUrl = `http://127.0.0.1:${port}`
  let status
  try {
    status = await fetch(`${serverUrl}/status`, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'error',
    })
    if (!status.ok || (await status.text()).trim() !== 'packager-status:running') {
      throw new Error('Metro is not running')
    }
  } catch {
    throw new Error(
      `Metro 개발 서버에 연결할 수 없습니다 (${serverUrl}). ` +
        'pnpm native:ios:dev로 시뮬레이터 앱을 먼저 실행해주세요. ' +
        '다른 포트를 사용한다면 pnpm native:web:sync --port <포트>로 지정해주세요.',
    )
  }

  const projectRoot = status.headers.get('X-React-Native-Project-Root')
  if (!projectRoot || realpathSync(decodeURI(projectRoot)) !== nativeRoot) {
    throw new Error(
      `${serverUrl}는 이 프로젝트의 Metro 서버가 아닙니다. --port로 올바른 포트를 지정해주세요.`,
    )
  }

  await new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/message?role=cli`)
    let settled = false
    let reloadRequested = false
    const timeout = setTimeout(() => {
      finish(new Error('Metro 리로드 응답 시간이 초과됐습니다. 앱 연결 상태를 확인해주세요.'))
    }, timeoutMs)

    function finish(error) {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      socket.terminate()
      if (error) reject(error)
      else resolve()
    }

    socket.once('open', () => {
      socket.send(JSON.stringify({ version: 2, method: 'getpeers', target: 'server', id: 'peers' }))
    })
    socket.on('message', (data) => {
      let message
      try {
        message = JSON.parse(data.toString())
      } catch {
        return
      }
      if (message?.version !== 2) return

      if (message.id === 'peers' && !reloadRequested) {
        const hasNativeApp = Object.values(message.result ?? {}).some((query) => {
          const params = new URLSearchParams(query)
          const role = params.get('role')
          return role === 'ios' || role === 'android' || params.has('app')
        })
        if (!hasNativeApp) {
          finish(new Error('Metro에 연결된 앱이 없습니다. 시뮬레이터에서 closet 앱을 열어주세요.'))
          return
        }
        reloadRequested = true
        socket.send(JSON.stringify({ version: 2, method: 'reload' }))
      } else if (reloadRequested && message.method === 'reload') {
        // Expo echoes broadcasts to the sender, confirming it relayed the request.
        finish()
      }
    })
    socket.once('error', () => finish(new Error('Metro 리로드 연결에 실패했습니다.')))
    socket.once('close', () => finish(new Error('리로드 요청 전에 Metro 연결이 종료됐습니다.')))
  })

  console.log('연결된 앱에 리로드를 요청했습니다. 시뮬레이터에서 새 웹 번들을 확인해주세요.')
}

try {
  const { values } = parseArgs({ options: { port: { type: 'string' } } })
  await reloadApp(values.port ?? process.env.RCT_METRO_PORT ?? '8081')
} catch (error) {
  console.error(`웹 번들은 갱신했지만 앱 리로드에 실패했습니다.\n${error.message}`)
  process.exitCode = 1
}
