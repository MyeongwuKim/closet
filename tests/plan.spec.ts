import { test, expect, createOutfit } from './support/fixture'

test('주간 플래너에 코디를 배치하고 비운 상태가 새로고침 후에도 유지된다', async ({ page, mockApi }) => {
  mockApi.outfits = [createOutfit({ id: '507f1f77bcf86cd799439011', name: '주간 테스트 코디' })]

  await page.goto('/plan?view=week')
  await expect(page.getByRole('radiogroup', { name: '플래너 보기 방식' }).getByRole('radio', { name: '주간' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: '일주일 코디 설정' }).click()

  let editor = page.getByRole('dialog', { name: '주간 코디 편집' })
  await expect(editor).toBeVisible()
  let firstDay = editor.getByLabel('설정할 요일').getByRole('button').first()
  await expect(firstDay).toHaveAttribute('aria-label', /저장된 코디 없음/)
  await editor.getByRole('button', { name: /주간 테스트 코디/ }).click()
  await expect(firstDay).toHaveAttribute('aria-label', /주간 테스트 코디, 설정됨/)
  expect(mockApi.operations).toContain('SetPlannerEntry')

  await editor.getByRole('button', { name: '주간 옷 설정 닫기' }).click()
  await page.reload()
  await page.getByRole('button', { name: '일주일 코디 설정' }).click()

  editor = page.getByRole('dialog', { name: '주간 코디 편집' })
  firstDay = editor.getByLabel('설정할 요일').getByRole('button').first()
  await expect(firstDay).toHaveAttribute('aria-label', /주간 테스트 코디, 설정됨/)

  await editor.getByRole('button', { name: '비우기' }).click()
  await expect(firstDay).toHaveAttribute('aria-label', /저장된 코디 없음/)
  expect(mockApi.operations).toContain('ClearPlannerEntry')

  await editor.getByRole('button', { name: '주간 옷 설정 닫기' }).click()
  await page.reload()
  await page.getByRole('button', { name: '일주일 코디 설정' }).click()
  await expect(page.getByRole('dialog', { name: '주간 코디 편집' }).getByLabel('설정할 요일').getByRole('button').first())
    .toHaveAttribute('aria-label', /저장된 코디 없음/)
})
