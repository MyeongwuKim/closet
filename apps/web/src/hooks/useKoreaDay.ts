import { useEffect, useState } from 'react'
import { getKoreaDate } from '@closet/types/wardrobe-preferences'

/** 화면을 열어 둔 채 한국 자정을 넘기거나 앱에 복귀할 때 날짜 조건을 갱신한다. 네트워크 요청은 하지 않는다. */
export function useKoreaDay() {
  const [day, setDay] = useState(getKoreaDate)
  useEffect(() => {
    const update = () => setDay(getKoreaDate())
    const interval = window.setInterval(update, 60_000)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => { window.clearInterval(interval); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update) }
  }, [])
  return day
}
