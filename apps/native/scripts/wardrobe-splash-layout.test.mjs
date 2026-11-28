import assert from 'node:assert/strict'
import test from 'node:test'
import { getWardrobeSplashOffset } from '../src/components/wardrobe/wardrobeSplashLayout.ts'

test('Safe Area 높이가 달라도 로그인과 WebView 로딩의 시작 위치는 전체 창 중앙이다', () => {
  for (const { height, top } of [{ height: 926, top: 47 }, { height: 852, top: 59 }, { height: 667, top: 20 }]) {
    for (const center of [16 + 220 / 2, 280 / 2]) {
      assert.equal(top + center + getWardrobeSplashOffset(height, top, center), height / 2)
    }
  }
})
