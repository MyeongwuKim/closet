import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'

/** 설정 메뉴를 누르면 해당 서랍을 160ms 동안 당긴 뒤 연결된 화면으로 이동한다. 동작 줄이기 설정에서는 바로 이동한다. */
export function useSettingsDrawerNavigation() {
  const navigate = useNavigate()
  /** 앞으로 당기는 메뉴의 경로. null이면 모든 서랍이 제자리에 있다. */
  const [openingPath, setOpeningPath] = useState<string | null>(null)
  const navigationTimer = useRef<number | undefined>(undefined)

  /** 일반 클릭·키보드 활성화에만 전환을 적용한다. 새 탭으로 여는 수정 키와 보조 클릭은 링크 기본 동작을 유지한다. */
  function openDrawer(event: MouseEvent<HTMLAnchorElement>, path: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    window.clearTimeout(navigationTimer.current)

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      navigate(path)
      return
    }

    setOpeningPath(path)
    navigationTimer.current = window.setTimeout(() => navigate(path), 160)
  }

  // 화면을 떠났다면 예약된 메뉴 이동이 다른 화면에서 실행되지 않게 한다.
  useEffect(() => () => window.clearTimeout(navigationTimer.current), [])

  return { openingPath, openDrawer }
}
