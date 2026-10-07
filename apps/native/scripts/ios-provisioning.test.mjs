import assert from 'node:assert/strict'
import test from 'node:test'
import { addProvisioningFlags } from './ios-provisioning.mjs'

test('서명 팀이 이미 지정된 실기기 빌드에도 자동 프로파일 갱신과 기기 등록을 요청한다', () => {
  const args = ['-workspace', 'closet.xcworkspace', '-configuration', 'Debug', '-scheme', 'closet', '-destination', 'id=phone', 'DEVELOPMENT_TEAM=existing-team']
  assert.deepEqual(addProvisioningFlags(args), [...args, '-allowProvisioningUpdates', '-allowProvisioningDeviceRegistration'])
  assert.equal(args.length, 9)
})

test('Expo가 이미 추가한 옵션은 중복하지 않는다', () => {
  const args = ['-project', 'closet.xcodeproj', '-destination', 'id=phone', '-allowProvisioningUpdates']
  assert.equal(addProvisioningFlags(args).filter((arg) => arg === '-allowProvisioningUpdates').length, 1)
  assert.ok(addProvisioningFlags(args).includes('-allowProvisioningDeviceRegistration'))
})

test('버전과 프로젝트 목록 조회에는 서명 옵션을 추가하지 않는다', () => {
  for (const args of [['-version'], ['-showsdks'], ['-workspace', 'closet.xcworkspace', '-list', '-json']]) {
    assert.deepEqual(addProvisioningFlags(args), args)
  }
})
