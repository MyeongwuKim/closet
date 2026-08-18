import { NavLink } from 'react-router-dom'

const navigation = [
  { label: '플래너', to: '/plan' },
  { label: '옷장', to: '/closet' },
  { label: '코디북', to: '/lookbook' },
  { label: '설정', to: '/settings' },
]

export function AppHeader() {
  return (
    <header className="hidden border-b border-line bg-canvas/90 backdrop-blur md:block">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-end px-8">
        <nav
          className="flex items-center gap-7 text-sm font-bold"
          aria-label="주요 메뉴"
        >
          {navigation.map((item) => (
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                isActive ? 'text-ink' : 'text-muted hover:text-ink'
              }
              key={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
