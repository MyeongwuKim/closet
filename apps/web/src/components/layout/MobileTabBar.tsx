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

export function MobileTabBar() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-line bg-surface/95 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      aria-label="모바일 주요 메뉴"
    >
      {tabs.map(({ label, to, icon: Icon }) => (
        <NavLink
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 py-1 text-[11px] ${
              isActive ? 'font-bold text-accent' : 'text-muted'
            }`
          }
          key={to}
        >
          <Icon size={20} /> {label}
        </NavLink>
      ))}
    </nav>
  )
}
