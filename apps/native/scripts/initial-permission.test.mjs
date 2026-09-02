import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

async function importTypeScript(relativePath) {
  const sourceUrl = new URL(relativePath, import.meta.url)
  const source = await readFile(sourceUrl, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourceUrl.pathname,
  })
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  return import(moduleUrl)
}

const {
  getInitialPermissionPromptSequence,
  hasCompletedPermissionPromptsForInstallation,
} = await importTypeScript('../src/permissions/initialPermissionSequence.ts')

test('같은 설치에서 완료한 권한 안내는 다시 열지 않는다', () => {
  assert.equal(
    hasCompletedPermissionPromptsForInstallation('1756796400000', '1756796400000'),
    true,
  )
})

test('재설치 시 이전 권한 안내 완료 기록을 사용하지 않는다', () => {
  assert.equal(
    hasCompletedPermissionPromptsForInstallation('1756796400000', '1756882800000'),
    false,
  )
})

test('첫 진입 안내는 알림 다음 위치 순서로 구성한다', () => {
  const sequence = getInitialPermissionPromptSequence()

  assert.deepEqual(sequence, ['notifications', 'location'])
})
