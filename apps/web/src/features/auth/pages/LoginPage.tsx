import { useState } from 'react'
import { LogIn, Sparkles } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { isLoggedIn } from '../../../lib/auth'
import { useTestLoginMutation } from '../api/authQueries'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const testLogin = useTestLoginMutation()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  if (isLoggedIn()) return <Navigate to="/plan" replace />

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')

    try {
      await testLogin.mutateAsync({
        loginId,
        password,
        displayName: displayName || undefined,
      })
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== '/login' ? from : '/plan', { replace: true })
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '로그인하지 못했습니다.',
      )
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-5 py-10 text-ink">
      <section className="w-full max-w-md overflow-hidden rounded-[2rem] border border-line bg-surface shadow-[0_24px_70px_rgba(27,27,24,0.12)]">
        <div className="border-b border-line p-6 sm:p-8">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-sage">
            <Sparkles size={22} />
          </span>
          <h1 className="mt-5 text-3xl font-black tracking-[-0.05em]">
            테스트 로그인
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            처음 사용하는 ID는 테스트 계정으로 자동 생성돼요. 옷장과 코디,
            플래너 정보는 이 계정에 저장됩니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 p-6 sm:p-8">
          <label className="grid gap-2 text-sm font-bold">
            테스트 ID
            <input
              value={loginId}
              onChange={(event) => setLoginId(event.target.value)}
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9._-]+"
              autoCapitalize="none"
              autoComplete="username"
              placeholder="예: closet_test"
              className="h-12 rounded-xl border border-line bg-canvas px-3 outline-none focus:border-ink"
              required
            />
          </label>

          <label className="grid gap-2 text-sm font-bold">
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={4}
              maxLength={72}
              autoComplete="current-password"
              placeholder="4자 이상"
              className="h-12 rounded-xl border border-line bg-canvas px-3 outline-none focus:border-ink"
              required
            />
          </label>

          <label className="grid gap-2 text-sm font-bold">
            표시 이름 <span className="font-normal text-muted">선택</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={30}
              placeholder="입력하지 않으면 ID로 표시"
              className="h-12 rounded-xl border border-line bg-canvas px-3 outline-none focus:border-ink"
            />
          </label>

          {errorMessage && (
            <p className="rounded-xl bg-accent/10 px-3 py-2.5 text-sm font-bold text-accent">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={testLogin.isPending}
            className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-bold text-white disabled:opacity-50"
          >
            <LogIn size={18} />
            {testLogin.isPending ? '로그인 중...' : '테스트 로그인'}
          </button>
        </form>
      </section>
    </main>
  )
}
