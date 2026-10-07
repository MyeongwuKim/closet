import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const navigation = [
  { label: '플래너', to: '/plan' },
  { label: '옷장', to: '/closet' },
  { label: '코디북', to: '/lookbook' },
  { label: '설정', to: '/settings' },
]

interface AppHeaderProps {
  actions?: ReactNode
}

/** 모바일에서는 브랜드 이름을, 넓은 화면에서는 주요 메뉴까지 표시한다. actions가 있으면 같은 줄 오른쪽에 화면별 조작 버튼을 배치한다. */
export function AppHeader({ actions }: AppHeaderProps) {
  return (
    <header className="bg-canvas text-ink">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8 md:h-20">
        <NavLink to="/plan" className="font-editorial text-[28px] tracking-[-0.06em]" aria-label="웨어룸 플래너">wearroom<span className="text-accent">.</span></NavLink>
        <div className="flex items-center gap-4">
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
          {actions}
        </div>
      </div>
    </header>
  )
}
