import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { createServer } from 'node:http'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { WebSocketServer } from 'ws'

const runFile = promisify(execFile)
const scriptPath = fileURLToPath(new URL('./reload-app.mjs', import.meta.url))
const nativeRoot = realpathSync(fileURLToPath(new URL('..', import.meta.url)))

async function createMetro(t, options = {}) {
  const messages = []
  const server = createServer((request, response) => {
    assert.equal(request.url, '/status')
    response.setHeader('X-React-Native-Project-Root', encodeURI(options.projectRoot ?? nativeRoot))
    response.end(options.statusBody ?? 'packager-status:running')
  })
  const sockets = new WebSocketServer({ server, path: '/message' })
  sockets.on('connection', (socket) => {
    socket.on('message', (data) => {
      const message = JSON.parse(data.toString())
      messages.push(message)
      if (options.disconnect) {
        socket.close()
      } else if (message.method === 'getpeers') {
        socket.send(JSON.stringify({
          version: 2,
          id: message.id,
          result: options.peers ?? { app: 'role=ios' },
        }))
      } else if (message.method === 'reload' && !options.ignoreReload) {
        socket.send(data.toString())
      }
    })
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  t.after(async () => {
    for (const socket of sockets.clients) socket.terminate()
    sockets.close()
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  })
  return { port: String(server.address().port), messages }
}

async function runReload(args, env = {}) {
  try {
    const result = await runFile(process.execPath, [scriptPath, ...args], {
      env: { ...process.env, ...env },
      timeout: 10000,
    })
    return { ...result, code: 0 }
  } catch (error) {
    return { stdout: error.stdout, stderr: error.stderr, code: error.code }
  }
}

test('연결된 iOS 앱을 확인한 뒤 리로드를 요청한다', async (t) => {
  const metro = await createMetro(t)
  const result = await runReload(['--port', metro.port], { RCT_METRO_PORT: 'invalid' })

  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /리로드를 요청했습니다/)
  assert.deepEqual(metro.messages, [
    { version: 2, method: 'getpeers', target: 'server', id: 'peers' },
    { version: 2, method: 'reload' },
  ])
})

test('RCT_METRO_PORT로 지정한 서버의 Android 앱도 리로드한다', async (t) => {
  const metro = await createMetro(t, {
    peers: { app: 'device=emulator&app=com.myeongwu.closet&clientid=android' },
  })
  const result = await runReload([], { RCT_METRO_PORT: metro.port })

  assert.equal(result.code, 0, result.stderr)
  assert.equal(metro.messages.at(-1).method, 'reload')
})

test('개발 도구만 연결되어 있으면 앱 실행을 안내하고 리로드하지 않는다', async (t) => {
  const metro = await createMetro(t, { peers: { tool: 'role=cli' } })
  const result = await runReload(['--port', metro.port])

  assert.equal(result.code, 1)
  assert.match(result.stderr, /Metro에 연결된 앱이 없습니다/)
  assert.deepEqual(metro.messages.map(({ method }) => method), ['getpeers'])
})

test('다른 프로젝트의 Metro에는 리로드 메시지를 보내지 않는다', async (t) => {
  const metro = await createMetro(t, { projectRoot: realpathSync(`${nativeRoot}/..`) })
  const result = await runReload(['--port', metro.port])

  assert.equal(result.code, 1)
  assert.match(result.stderr, /이 프로젝트의 Metro 서버가 아닙니다/)
  assert.equal(metro.messages.length, 0)
})

test('Metro가 아닌 서버에는 개발 서버 실행 방법을 안내한다', async (t) => {
  const metro = await createMetro(t, { statusBody: 'OK' })
  const result = await runReload(['--port', metro.port])

  assert.equal(result.code, 1)
  assert.match(result.stderr, /pnpm native:ios:dev/)
  assert.equal(metro.messages.length, 0)
})

test('잘못된 포트는 연결 전에 거부한다', async () => {
  for (const port of ['0', '65536', 'abc']) {
    const result = await runReload(['--port', port])
    assert.equal(result.code, 1)
    assert.match(result.stderr, /1~65535/)
  }
})

test('소켓이 먼저 닫히면 리로드 성공으로 표시하지 않는다', async (t) => {
  const metro = await createMetro(t, { disconnect: true })
  const result = await runReload(['--port', metro.port])

  assert.equal(result.code, 1)
  assert.match(result.stderr, /Metro 연결이 종료/)
})

test('서버가 리로드를 전달하지 않으면 시간 초과로 종료한다', async (t) => {
  const metro = await createMetro(t, { ignoreReload: true })
  const result = await runReload(['--port', metro.port])

  assert.equal(result.code, 1)
  assert.match(result.stderr, /응답 시간이 초과/)
  assert.doesNotMatch(result.stdout, /리로드를 요청했습니다/)
})
