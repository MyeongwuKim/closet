import assert from 'node:assert/strict'
import test from 'node:test'
import { confirmIosVersion } from './confirm-ios-version.mjs'

const build = { environment: 'development', name: '웨어룸(T)', version: '1.0.0', identifier: 'com.myeongwu.wearoom.dev' }
const output = { write() {} }

test('dev/prod는 명시적으로 y 또는 yes라고 답한 경우에만 진행한다', async () => {
  for (const environment of ['development', 'production']) {
    for (const answer of ['y', 'Y', ' yes ']) assert.equal(await confirmIosVersion({ ...build, environment }, { output, ask: async () => answer }), true)
    for (const answer of ['', 'n', 'no', '다른버전']) assert.equal(await confirmIosVersion({ ...build, environment }, { output, ask: async () => answer }), false)
  }
})

test('확인 화면은 실제 선택한 앱 이름·버전·식별자를 표시한다', async () => {
  let message = ''
  await confirmIosVersion(build, { output: { write(text) { message += text } }, ask: async () => 'n' })
  assert.match(message, /웨어룸\(T\)/)
  assert.match(message, /1\.0\.0/)
  assert.match(message, /com\.myeongwu\.wearoom\.dev/)
})

test('local은 확인하지 않으며 dev/prod는 비대화형 실행을 거절한다', async () => {
  assert.equal(await confirmIosVersion({ ...build, environment: 'local' }, { ask: () => { throw new Error('local must not prompt') } }), true)
  await assert.rejects(confirmIosVersion(build, { output, input: { isTTY: false } }), /대화형 터미널/)
})

test('앱 정책과 웹 호환 설정을 구분해서 표시하고 실제 선택한 값으로 검사한다', async () => {
  let message = ''
  const policy = { enabled: true, minimumVersion: '1.0.0', storeUrl: 'https://apps.apple.com/app/id123' }
  const runtime = { minimumNativeVersion: '1.1.0' }
  const confirmed = await confirmIosVersion({ ...build, version: '1.1.0' }, {
    output: { write(text) { message += text } }, policy, runtime, ask: async prompt => {
      assert.match(prompt, /이 설정으로 빌드를 진행/)
      return 'y'
    },
  })
  assert.equal(confirmed, true)
  assert.match(message, /iOS 빌드 버전 확인 · dev/)
  assert.match(message, /앱 업데이트 정책/)
  assert.match(message, /강제 업데이트\s+사용/)
  assert.match(message, /웹 번들 호환 설정/)
  assert.match(message, /이 빌드의 호환 기준\s+충족/)
  assert.match(message, /로컬 설정 파일 기준/)
  assert.match(message, /https:\/\/apps.apple.com/)
})

test('웹 호환 최소 버전이나 활성 정책 최소 버전보다 낮으면 질문 전에 중단한다', async () => {
  const ask = async () => { throw new Error('must stop before asking') }
  await assert.rejects(confirmIosVersion(build, { output, ask, policy: { enabled: false, minimumVersion: '1.0.0' }, runtime: { minimumNativeVersion: '1.0.1' } }), /웹 번들 최소/)
  await assert.rejects(confirmIosVersion(build, { output, ask, policy: { enabled: true, minimumVersion: '1.1.0' }, runtime: { minimumNativeVersion: '1.0.0' } }), /강제 업데이트 최소/)
})
