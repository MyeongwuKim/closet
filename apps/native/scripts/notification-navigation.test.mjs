import assert from 'node:assert/strict'
import test from 'node:test'
import { getNotificationWebPath } from '../src/notifications/notificationNavigation.ts'

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
