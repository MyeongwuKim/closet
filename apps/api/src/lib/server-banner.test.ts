import assert from 'node:assert/strict'
import type { NetworkInterfaceInfo } from 'node:os'
import test from 'node:test'
import { createServerBanner } from './server-banner.js'

function ipv4(address: string, internal = false): NetworkInterfaceInfo {
  return {
    address,
    family: 'IPv4',
    internal,
    netmask: '255.255.255.0',
    mac: '00:00:00:00:00:00',
    cidr: `${address}/24`,
  }
}

test('LAN IPv4 주소와 실행 포트를 중복 없이 박스에 표시한다', () => {
  const banner = createServerBanner('0.0.0.0', 4100, {
    lo0: [ipv4('127.0.0.1', true)],
    en0: [
      ipv4('192.168.0.20'),
      {
        ...ipv4('fe80::1'),
        family: 'IPv6',
        scopeid: 1,
      },
    ],
    en1: [ipv4('192.168.0.20'), ipv4('10.0.0.2')],
    en2: [ipv4('169.254.1.2')],
    missing: undefined,
  })

  assert.match(banner, /Local:   http:\/\/localhost:4100/)
  assert.equal(banner.split('Network: http://192.168.0.20:4100').length - 1, 1)
  assert.match(banner, /Network: http:\/\/10\.0\.0\.2:4100/)
  assert.doesNotMatch(banner, /127\.0\.0\.1|fe80::1|169\.254\.1\.2/)

  const rows = banner.trim().split('\n')
  assert.ok(rows[0].startsWith('┌') && rows[0].endsWith('┐'))
  assert.ok(rows.at(-1)?.startsWith('└') && rows.at(-1)?.endsWith('┘'))
  assert.ok(rows.every((row) => row.length === rows[0].length))
})

test('LAN 주소가 없으면 로컬 주소와 안내를 표시한다', () => {
  const banner = createServerBanner('0.0.0.0', 4000, {})

  assert.match(banner, /http:\/\/localhost:4000/)
  assert.match(banner, /no LAN IPv4 address found/)
})

test('특정 호스트에 바인딩하면 다른 인터페이스의 주소를 노출하지 않는다', () => {
  for (const host of ['localhost', '127.0.0.1', '192.168.0.20']) {
    const banner = createServerBanner(host, 4000, { en0: [ipv4('10.0.0.2')] })

    assert.ok(banner.includes(`http://${host}:4000`))
    assert.doesNotMatch(banner, /Network:|10\.0\.0\.2/)
  }
})

test('IPv6 호스트의 URL은 대괄호로 감싼다', () => {
  const banner = createServerBanner('::1', 4000, {})

  assert.ok(banner.includes('http://[::1]:4000'))
})
