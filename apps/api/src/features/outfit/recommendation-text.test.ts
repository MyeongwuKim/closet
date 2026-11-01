import assert from 'node:assert/strict'
import test from 'node:test'
import { isRecommendationText } from './recommendation-text.js'

test('실제 AI 응답에 섞인 색상 역할 코드나 내부 속성명을 사용자 설명으로 내보내지 않는다', () => {
  assert.equal(isRecommendationText('무난한(safe), 자연스럽게 이어지는(harmony), 포인트(accent)로 추천합니다.', 360), false)
  assert.equal(isRecommendationText('fashionAttributes의 regular 핏입니다.', 200), false)
  assert.equal(isRecommendationText('차분한 네이비에 밝은 베이지를 함께 골랐어요.', 200), true)
})
