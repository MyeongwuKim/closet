import { BarChart3, ChevronRight, CloudSun, History, Info, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSettingsDrawerNavigation } from '../hooks/useSettingsDrawerNavigation'
import './SettingsDrawerList.css'

const drawers = [
  { path: '/settings/style-profile', title: '스타일 프로필', description: '체형과 치수, 룩북에 맞는 핏', icon: Sparkles },
  { path: '/settings/wear-reminder', title: '최근 착용 리마인드', description: '같은 옷을 다시 입는 간격', icon: History },
  { path: '/settings/notifications-weather', title: '알림 및 날씨', description: '알림과 위치 기반 날씨', icon: CloudSun },
  { path: '/settings/statistics', title: '옷장 통계', description: '옷의 구성과 자주 입는 조합', icon: BarChart3 },
  { path: '/settings/app-info', title: '앱 정보', description: '앱 버전과 실행 정보', icon: Info },
]

/** 설정의 다섯 메뉴를 하나의 수납장 안에 이어진 서랍으로 표시한다. 메뉴 이동과 선택한 서랍의 움직임은 전용 훅에 맡긴다. */
export function SettingsDrawerList() {
  const { openingPath, openDrawer } = useSettingsDrawerNavigation()

  return (
    <nav className="settings-cabinet" aria-label="설정 메뉴">
      {drawers.map(({ path, title, description, icon: Icon }) => (
        <Link
          key={path}
          to={path}
          className="settings-drawer"
          data-opening={openingPath === path ? 'true' : undefined}
          onClick={(event) => openDrawer(event, path)}
        >
          <Icon className="settings-drawer-icon" size={21} strokeWidth={1.6} aria-hidden="true" />
          <span className="settings-drawer-copy">
            <strong>{title}</strong>
            <span>{description}</span>
          </span>
          <ChevronRight className="settings-drawer-arrow" size={17} strokeWidth={1.5} aria-hidden="true" />
        </Link>
      ))}
    </nav>
  )
}
