import assert from 'node:assert/strict'
import test from 'node:test'
import { requireSuccessfulRegression } from './check-regression-status.mjs'

function fixture(runs) {
  return { owner: 'test', repo: 'closet', sha: 'current-sha', github: {
    rest: { actions: { listWorkflowRuns() {} } },
    async paginate(_method, params) {
      assert.equal(params.workflow_id, 'regression.yml')
      assert.equal(params.head_sha, 'current-sha')
      assert.equal(params.status, 'completed')
      return runs
    },
  } }
}
const passed = { head_sha: 'current-sha', status: 'completed', conclusion: 'success', event: 'push', head_branch: 'main', html_url: 'https://example.test/run' }

test('reuses a main or manually dispatched successful full regression for the same commit', async () => {
  assert.equal(await requireSuccessfulRegression(fixture([passed])), passed.html_url)
  assert.equal(await requireSuccessfulRegression(fixture([{ ...passed, event: 'workflow_dispatch', head_branch: 'release' }])), passed.html_url)
})

test('does not accept another commit, failed, running, cancelled, or unrelated runs', async () => {
  for (const change of [{ head_sha: 'old-sha' }, { conclusion: 'failure' }, { status: 'in_progress' }, { conclusion: 'cancelled' }, { event: 'pull_request' }, { head_branch: 'develop' }]) {
    await assert.rejects(requireSuccessfulRegression(fixture([{ ...passed, ...change }])), /통과 기록이 없습니다/)
  }
  await assert.rejects(requireSuccessfulRegression(fixture([])), /해당 커밋/)
})

test('API errors stop the production gate instead of permitting a publication', async () => {
  const config = fixture([])
  config.github.paginate = async () => { throw new Error('GitHub API unavailable') }
  await assert.rejects(requireSuccessfulRegression(config), /GitHub API unavailable/)
})
