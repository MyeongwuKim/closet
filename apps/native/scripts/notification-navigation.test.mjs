import assert from 'node:assert/strict'
import test from 'node:test'
import { getForegroundNotificationWebPath, getNotificationWebPath } from '../src/notifications/notificationNavigation.ts'
import { createWebViewNavigationQueue } from '../src/navigation/webViewNavigation.ts'

test('완료 푸시를 누른 응답은 앱이 활성화되고 웹뷰가 준비될 때까지 유지한다', () => {
  const queue = createWebViewNavigationQueue()
  const paths = []
  const deliver = (path, id) => paths.push({ path, id })
  const resultPath = '/lookbook/new?items=item-1,item-2&preview=open&previewAssetId=asset-1'
  queue.enqueue(resultPath)

  queue.flush({ isReady: true, isActive: false }, deliver)
  queue.flush({ isReady: false, isActive: true }, deliver)
  assert.deepEqual(paths, [])

  queue.flush({ isReady: true, isActive: true }, deliver)
  assert.deepEqual(paths, [{ path: resultPath, id: 1 }])
  queue.acknowledge(1)
  queue.flush({ isReady: true, isActive: true }, deliver)
  assert.equal(paths.length, 1)
})

test('웹 수신 확인을 잃으면 준비된 웹뷰에 다시 전달하고 이전 확인으로 새 알림을 지우지 않는다', () => {
  const queue = createWebViewNavigationQueue()
  const ready = { isReady: true, isActive: true }
  const paths = []
  const deliver = (path, id) => paths.push([path, id])

  queue.enqueue('/lookbook?previewAssetId=first')
  queue.flush(ready, deliver)
  queue.flush(ready, deliver)
  queue.enqueue('/lookbook?previewAssetId=latest')
  queue.acknowledge(1)
  queue.flush(ready, deliver)
  assert.deepEqual(paths, [
    ['/lookbook?previewAssetId=first', 1],
    ['/lookbook?previewAssetId=first', 1],
    ['/lookbook?previewAssetId=latest', 2],
  ])
})

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
