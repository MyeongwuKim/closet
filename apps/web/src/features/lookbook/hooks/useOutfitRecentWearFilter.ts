import { useState } from 'react'
import { getKoreaPlannerToday } from '../../plan/utils/plannerWear'
import { defaultWearReminderPreferences, useMeQuery } from '../../settings/api/profileQueries'

/** 옷 선택을 열 때 숨기기를 끈 상태에서 시작하고, 확인 팝업의 켜짐 여부와 별개로 저장한 기간을 사용한다. */
export function useOutfitRecentWearFilter() {
  const [hideRecentlyWorn, setHideRecentlyWorn] = useState(false)
  const { data: viewer } = useMeQuery()
  const recentWearDays = viewer?.wearReminderPreferences?.intervalDays ?? defaultWearReminderPreferences.intervalDays

  return { recentWearDays, today: getKoreaPlannerToday(), hideRecentlyWorn, setHideRecentlyWorn }
}
