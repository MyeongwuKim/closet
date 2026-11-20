/** Reuse only a successful full regression run for the exact commit being published. */
export async function requireSuccessfulRegression({ github, owner, repo, sha }) {
  const runs = await github.paginate(github.rest.actions.listWorkflowRuns, {
    owner,
    repo,
    workflow_id: 'regression.yml',
    head_sha: sha,
    status: 'completed',
    per_page: 100,
  })
  const successful = runs.find(run =>
    run.head_sha === sha &&
    run.status === 'completed' &&
    run.conclusion === 'success' &&
    (run.event === 'workflow_dispatch' || (run.event === 'push' && run.head_branch === 'main')),
  )
  if (!successful) {
    throw new Error(`커밋 ${sha}의 전체 회귀 검사 통과 기록이 없습니다. E2E regression을 해당 커밋에서 실행해 통과한 뒤 prod 배포를 다시 실행해주세요.`)
  }
  return successful.html_url
}
