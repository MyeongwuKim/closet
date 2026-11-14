import type { TemperatureWearRecord } from '@closet/types'
import type { SavedOutfit } from '../lookbook/types'

/** 같은 옷 조합의 전체 착용 기록과 현재 필터에 맞는 대표 날짜의 코디 복사본. */
export interface WearHistoryGroup {
  id: string
  outfit: SavedOutfit
  matchingDate: string
  records: TemperatureWearRecord[]
}
