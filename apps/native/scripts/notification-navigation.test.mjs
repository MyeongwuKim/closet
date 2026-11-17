import assert from 'node:assert/strict'
import test from 'node:test'
import { getForegroundNotificationWebPath, getNotificationWebPath } from '../src/notifications/notificationNavigation.ts'

test('재발견 알림은 누르면 전용 목록으로 이동하고 실행 중 수신만으로는 화면을 바꾸지 않는다', () => {
  const data = { type: 'wardrobe-rediscovery', path: '/closet/rediscovery' }
  assert.equal(getNotificationWebPath(data), data.path)
  assert.equal(getForegroundNotificationWebPath(data), null)
  for (const path of ['https://evil.example/closet/rediscovery', '/closet/other', '/settings', '/closet/rediscovery?redirect=external']) {
    assert.equal(getNotificationWebPath({ ...data, path }), null)
  }
})

test('AI 완료 알림의 앱 내부 경로를 그대로 복구한다', () => {
  assert.equal(
    getNotificationWebPath({
      type: 'ai-completion',
      path: '/lookbook/new?items=item-1,item-2&previewAssetId=asset-1&preview=open',
    }),
    '/lookbook/new?items=item-1,item-2&previewAssetId=asset-1&preview=open',
  )
})

test('일반 알림과 허용되지 않은 화면은 이동 경로로 사용하지 않는다', () => {
  assert.equal(
    getNotificationWebPath({ type: 'push-test', path: '/lookbook' }),
    null,
  )
  assert.equal(
    getNotificationWebPath({ type: 'ai-completion', path: '/admin' }),
    null,
  )
})

test('AI 실패 알림도 다시 시도할 작성 화면으로 연결한다', () => {
  assert.equal(
    getNotificationWebPath({
      type: 'ai-failure',
      path: '/lookbook/new?items=item-1,item-2&preview=failed',
    }),
    '/lookbook/new?items=item-1,item-2&preview=failed',
  )
})


test('실행 중 룩북 완료·실패 알림은 자동 이동하지 않고 웹 팝업에 맡긴다', () => {
  for (const type of ['ai-completion', 'ai-failure']) {
    const data = { type, kind: 'outfit-preview', path: '/lookbook/new?items=item-1,item-2' }
    assert.equal(getForegroundNotificationWebPath(data), null)
    assert.equal(getNotificationWebPath(data), data.path)
  }
  assert.equal(getForegroundNotificationWebPath({ type: 'ai-completion', kind: 'wardrobe-classification', path: '/closet' }), '/closet')
})
