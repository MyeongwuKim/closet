import { BarChart3, Bell, ChevronRight, History, Info, Shirt, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSettingsDrawerNavigation } from '../hooks/useSettingsDrawerNavigation'
import './SettingsDrawerList.css'

interface SettingsMenuItem {
  path: string
  title: string
  icon: LucideIcon
}

const menuGroups: Array<{ title: string; items: SettingsMenuItem[] }> = [
  {
    title: '옷장 관리',
    items: [
      { path: '/settings/wear-reminder', title: '최근 착용 리마인드', icon: History },
      { path: '/settings/statistics', title: '옷장 통계', icon: BarChart3 },
    ],
  },
  {
    title: '앱 설정',
    items: [
      { path: '/settings/notifications-weather', title: '알림 및 날씨', icon: Bell },
      { path: '/settings/app-info', title: '앱 정보', icon: Info },
    ],
  },
]

/** 스타일 프로필을 첫 카드로 표시하고 나머지 설정은 옷장 관리와 앱 설정으로 묶는다. 각 항목의 이동은 기존 메뉴 전환 훅에 맡긴다. */
export function SettingsDrawerList() {
  const { openingPath, openDrawer } = useSettingsDrawerNavigation()
  const profilePath = '/settings/style-profile'

  return (
    <nav className="settings-menu" aria-label="설정 메뉴">
      <Link
        to={profilePath}
        className="settings-profile-card"
        data-opening={openingPath === profilePath ? 'true' : undefined}
        onClick={(event) => openDrawer(event, profilePath)}
      >
        <span className="settings-profile-icon"><Shirt size={28} strokeWidth={1.55} aria-hidden="true" /></span>
        <span className="settings-profile-copy">
          <strong>스타일 프로필</strong>
          <span>체형 · 치수 · 선호 핏</span>
        </span>
        <ChevronRight className="settings-menu-arrow" size={20} strokeWidth={1.6} aria-hidden="true" />
      </Link>

      {menuGroups.map((group) => (
        <section className="settings-menu-group" aria-label={group.title} key={group.title}>
          <h2 className="settings-menu-heading">{group.title}</h2>
          <div className="settings-menu-card">
            {group.items.map(({ path, title, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className="settings-menu-row"
                data-opening={openingPath === path ? 'true' : undefined}
                onClick={(event) => openDrawer(event, path)}
              >
                <Icon className="settings-menu-icon" size={22} strokeWidth={1.6} aria-hidden="true" />
                <span>{title}</span>
                <ChevronRight className="settings-menu-arrow" size={19} strokeWidth={1.6} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </nav>
  )
}
