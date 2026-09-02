/**
 * 용도:
 * 플래너에 코디를 저장하기 전 최근 착용 충돌을 조회한다.
 *
 * 요청 흐름:
 * 선택한 옷과 대상 날짜, 사용자 알림 기준을 서버에 전달하고
 * 가장 우선순위가 높은 최근 착용 기록 한 건을 반환한다.
 */
import { graphqlRequest } from '../../../lib/graphql'
import type { RecentWearConflict } from '../utils/recentWearReminder'

export interface RecentWearConflictVariables {
  itemIds: string[]
  targetDate: string
  includeTargetDate: boolean
  intervalDays: number
  combinationReminderEnabled: boolean
  itemReminderEnabled: boolean
}

export async function fetchRecentWearConflict(
  input: RecentWearConflictVariables,
) {
  const data = await graphqlRequest<
    { recentWearConflict: RecentWearConflict | null },
    { input: RecentWearConflictVariables }
  >(
    `
      query RecentWearConflict($input: RecentWearConflictInput!) {
        recentWearConflict(input: $input) {
          kind
          wornDate
          itemIds
          outfitName
        }
      }
    `,
    { input },
  )

  return data.recentWearConflict
}
