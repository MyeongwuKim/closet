import { useEffect, useState } from 'react'
import { subscribeWeatherReturn } from '../../weather/utils/weatherRefresh'
import { getKoreaPlannerToday, getKoreaPlannerTomorrow } from '../utils/plannerWear'

/** 화면을 열어 둔 채 한국 자정을 넘기거나 앱에 복귀하면 기준 날짜를 갱신한다. */
export function useKoreaPlannerToday() {
  const [today, setToday] = useState(getKoreaPlannerToday)

  useEffect(() => {
    let midnightTimer: number
    const updateToday = () => {
      const now = new Date()
      const koreaDay = getKoreaPlannerToday(now)
      setToday(koreaDay)
      window.clearTimeout(midnightTimer)
      const nextMidnight = Date.parse(`${getKoreaPlannerTomorrow(koreaDay)}T00:00:00+09:00`)
      midnightTimer = window.setTimeout(updateToday, nextMidnight - now.getTime())
    }
    updateToday()
    const unsubscribe = subscribeWeatherReturn(updateToday)
    return () => {
      window.clearTimeout(midnightTimer)
      unsubscribe()
    }
  }, [])

  return today
}
