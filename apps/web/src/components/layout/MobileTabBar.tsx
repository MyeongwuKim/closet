import {
  CalendarDays,
  Grid2X2,
  Images,
  Settings,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

const tabs = [
  { label: '플래너', to: '/plan', icon: CalendarDays },
  { label: '옷장', to: '/closet', icon: Grid2X2 },
  { label: '코디북', to: '/lookbook', icon: Images },
  { label: '설정', to: '/settings', icon: Settings },
]

/** 모바일 하단에서 플래너·옷장·코디북·설정으로 이동한다. 현재 메뉴는 세이지 배경과 녹색 글자로 표시한다. */
export function MobileTabBar() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 gap-1 border-t border-line bg-surface px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden"
      aria-label="모바일 주요 메뉴"
    >
      {tabs.map(({ label, to, icon: Icon }) => (
        <NavLink
          to={to}
          className={({ isActive }) =>
            `relative flex min-h-11 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] transition-colors ${
              isActive ? 'bg-sage font-semibold text-accent' : 'text-muted'
            }`
          }
          key={to}
        >
          <Icon size={19} strokeWidth={1.5} /> {label}
        </NavLink>
      ))}
    </nav>
  )
}
