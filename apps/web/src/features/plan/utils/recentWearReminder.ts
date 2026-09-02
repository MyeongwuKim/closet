/**
 * 용도:
 * 최근 착용 충돌을 사용자에게 보여줄 제목과 설명으로 정리한다.
 *
 * 동작 방식:
 * 충돌 종류와 겹친 옷 이름, 기준 날짜를 조합해
 * 같은 코디·조합·개별 옷에 맞는 안내 문구를 반환한다.
 */
import type { WardrobeItem } from '@closet/types'
import { formatWearDate } from '../../../utils/wearDate'

const DAY_IN_MS = 24 * 60 * 60 * 1000

export type RecentWearConflictKind = 'exact' | 'combination' | 'item'

export interface RecentWearConflict {
  kind: RecentWearConflictKind
  wornDate: string
  itemIds: string[]
  outfitName: string | null
}

export interface RecentWearReminderRequest extends RecentWearConflict {
  targetDate: string
  intervalDays: number
  confirmLabel: string
  cancelLabel: string
}

export interface RecentWearReminderCopy {
  title: string
  description: string
}

function getDateOnlyTimestamp(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const timestamp = Date.UTC(year, month - 1, day)
  const parsed = new Date(timestamp)

  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
    ? timestamp
    : null
}

function formatRelativeWearDate(wornDate: string, targetDate: string) {
  const wornTimestamp = getDateOnlyTimestamp(wornDate)
  const targetTimestamp = getDateOnlyTimestamp(targetDate)
  if (wornTimestamp === null || targetTimestamp === null) {
    return `${formatWearDate(wornDate)}에`
  }

  const daysAgo = Math.round((targetTimestamp - wornTimestamp) / DAY_IN_MS)
  if (daysAgo === 1) return '하루 전에'
  if (daysAgo === 7) return '일주일 전에'
  if (daysAgo > 1) return `${daysAgo}일 전에`
  return `${formatWearDate(wornDate)}에`
}

function joinItemNames(names: string[]) {
  if (names.length === 0) return '선택한 옷'
  if (names.length === 1) return names[0]
  if (names.length === 2) {
    const lastCharacter = names[0].at(-1) ?? ''
    const characterCode = lastCharacter.charCodeAt(0)
    const hasFinalConsonant =
      characterCode >= 0xac00 &&
      characterCode <= 0xd7a3 &&
      (characterCode - 0xac00) % 28 !== 0
    return `${names[0]}${hasFinalConsonant ? '과' : '와'} ${names[1]}`
  }
  return `${names[0]}, ${names[1]} 외 ${names.length - 2}개`
}

export function getRecentWearReminderCopy(
  reminder: RecentWearReminderRequest,
  wardrobeItems: WardrobeItem[],
): RecentWearReminderCopy {
  const itemById = new Map(wardrobeItems.map((item) => [item.id, item]))
  const itemNames = reminder.itemIds.flatMap((itemId) => {
    const name = itemById.get(itemId)?.name.trim()
    return name ? [name] : []
  })
  const relativeDate = formatRelativeWearDate(
    reminder.wornDate,
    reminder.targetDate,
  )
  const intervalDescription = `최근 ${reminder.intervalDays}일 이내의 착용 기록이에요. 그래도 계속할까요?`

  if (reminder.kind === 'exact') {
    const outfitLabel = reminder.outfitName?.trim()
      ? `'${reminder.outfitName.trim()}'와 같은 구성을`
      : '같은 코디를'
    return {
      title: '같은 코디를 최근에 입었어요',
      description: `${outfitLabel} ${relativeDate} 입었어요. ${intervalDescription}`,
    }
  }

  if (reminder.kind === 'combination') {
    return {
      title: '최근에 입은 조합이에요',
      description: `${joinItemNames(itemNames)} 조합을 ${relativeDate} 입었어요. ${intervalDescription}`,
    }
  }

  return {
    title: '최근에 입은 옷이에요',
    description: `'${joinItemNames(itemNames)}' 아이템을 ${relativeDate} 입었어요. ${intervalDescription}`,
  }
}
