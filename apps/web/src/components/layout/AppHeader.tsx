import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { TestAiCreditRefillButton } from '../../features/lookbook/components/TestAiCreditRefillButton'

const navigation = [
  { label: '플래너', to: '/plan' },
  { label: '옷장', to: '/closet' },
  { label: '코디북', to: '/lookbook' },
  { label: '설정', to: '/settings' },
]

interface AppHeaderProps {
  actions?: ReactNode
}

/** 브랜드·주요 메뉴와 화면별 조작을 표시한다. 개발 빌드에서는 서버가 허용한 테스트 충전 버튼도 오른쪽에 배치한다. */
export function AppHeader({ actions }: AppHeaderProps) {
  return (
    <header className="bg-canvas text-ink">
      <div className="app-header-content mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-8">
        <NavLink to="/plan" className="font-editorial text-[28px] tracking-[-0.06em]" aria-label="wearroom 플래너">wearroom<span className="text-accent">.</span></NavLink>
        <div className="flex items-center gap-2 sm:gap-4">
          <nav
            className="hidden items-center gap-2 text-sm font-medium md:flex"
            aria-label="주요 메뉴"
          >
            {navigation.map((item) => (
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2.5 transition-colors ${isActive ? 'bg-sage text-accent' : 'text-muted hover:bg-surface hover:text-ink'}`
                }
                key={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          {import.meta.env.MODE !== 'production' && <TestAiCreditRefillButton />}
          {actions}
        </div>
      </div>
    </header>
  )
}
