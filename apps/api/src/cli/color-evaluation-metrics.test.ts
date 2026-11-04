import assert from 'node:assert/strict'
import test from 'node:test'
import { deltaE76, median, rgbToLab } from './color-evaluation-metrics.js'

test('독립 색차 지표는 D65 흰색·검정의 기준점과 대칭성을 유지한다', () => {
  const white = rgbToLab([255, 255, 255])
  assert.ok(Math.abs(white[0] - 100) < 0.001)
  assert.ok(Math.abs(white[1]) < 0.001 && Math.abs(white[2]) < 0.001)
  assert.deepEqual(rgbToLab([0, 0, 0]), [0, 0, 0])
  assert.equal(deltaE76([20, 40, 80], [20, 40, 80]), 0)
  assert.equal(deltaE76([20, 40, 80], [120, 140, 180]), deltaE76([120, 140, 180], [20, 40, 80]))
  assert.ok(Math.abs(deltaE76([0, 0, 0], [255, 255, 255]) - 100) < 0.001)
  assert.equal(median([2, 200, 4]), 4)
  assert.equal(median([2, 4]), 3)
})
