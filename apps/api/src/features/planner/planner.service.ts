/**
 * 용도:
 * 플래너 조회·편집, 실제 착용 확인·취소와 체감 기록을 검증하고 최근 착용 알림에 필요한 충돌을 계산한다.
 *
 * 동작 방식:
 * 날짜와 사용자 소유 코디를 확인하고 날짜마다 독립된 코디 복사본을 저장하며,
 * 오늘 이후 배정에는 허용된 마지막 날씨 지역을 연결해 날짜가 지난 뒤 기온을 기록할 수 있게 한다.
 * 최근 착용 검사는 설정된 기간 안의 기록만 조회해 우선순위가 가장 높은 결과를 반환한다.
 */

import type { OutfitStyle, WearFeeling } from '@prisma/client'
import { ServiceError } from '../../graphql/errors.js'
import { parseDateOnly, toDateOnly } from '../../lib/date.js'
import { outfitRepository } from '../outfit/outfit.repository.js'
import {
  outfitService,
  type CreateOutfitInput,
} from '../outfit/outfit.service.js'
import { plannerRepository } from './planner.repository.js'
import { getKoreaTodayUtc } from '../wardrobe/wardrobe.service.js'
import { findRecentWearConflict } from './recent-wear-conflict.js'
import { wearWeatherRepository } from './wear-weather.repository.js'

export interface SetPlannerEntryInput {
  weekStartsOn: string
  date: string
  outfitId: string
  title?: string | null
  occasion?: string | null
  weatherSummary?: string | null
  temperatureC?: number | null
}

/** 착용 버튼을 눌렀을 때 본 코디 ID를 포함해, 다른 탭에서 교체한 코디가 잘못 확인되지 않게 한다. */
export interface SetPlannerEntryWornInput {
  weekStartsOn: string
  date: string
  outfitId: string
  worn: boolean
}

/** 체감을 고를 때 보고 있던 착용 확인 시각을 함께 보내, 취소·재확인한 새 기록을 이전 화면이 수정하지 않게 한다. */
export interface SetPlannerEntryWearFeelingInput {
  weekStartsOn: string
  date: string
  outfitId: string
  wornAt: string
  feeling: WearFeeling | null
}

export interface SetDirectPlannerEntryInput {
  weekStartsOn: string
  date: string
  itemIds: string[]
  previewImage?: CreateOutfitInput['previewImage']
  recommendationName?: string | null
  /** 새 추천의 표시명(옷장 추천) 또는 이전 추천의 스타일명. 저장할 코디의 분류와 중복 확인에 사용한다. */
  recommendationStyle?: string | null
  weatherSummary?: string | null
  temperatureC?: number | null
}

export interface MovePlannerEntryInput {
  weekStartsOn: string
  sourceDate: string
  targetDate: string
}

export interface RecentWearConflictInput {
  itemIds: string[]
  targetDate: string
  intervalDays: number
  combinationReminderEnabled: boolean
  itemReminderEnabled: boolean
  includeTargetDate?: boolean
}

const objectIdPattern = /^[a-f\d]{24}$/i
const dayInMilliseconds = 24 * 60 * 60 * 1000

function validateRecentWearConflictInput(input: RecentWearConflictInput) {
  if (
    !Number.isInteger(input.intervalDays) ||
    input.intervalDays < 1 ||
    input.intervalDays > 30
  ) {
    throw new ServiceError(
      '최근 착용 알림 간격은 1일에서 30일 사이여야 합니다.',
      'INVALID_WEAR_REMINDER_INTERVAL',
    )
  }
  if (input.itemIds.length === 0) {
    throw new ServiceError(
      '최근 착용을 확인할 옷을 하나 이상 선택해주세요.',
      'INVALID_WEAR_REMINDER_ITEMS',
    )
  }
  if (input.itemIds.length > 20) {
    throw new ServiceError(
      '최근 착용은 옷을 최대 20개까지 확인할 수 있습니다.',
      'WEAR_REMINDER_ITEM_LIMIT_EXCEEDED',
    )
  }
  if (input.itemIds.some((itemId) => !objectIdPattern.test(itemId))) {
    throw new ServiceError(
      '올바르지 않은 옷장 아이템이 포함되어 있습니다.',
      'INVALID_WARDROBE_ITEM_ID',
    )
  }
  if (new Set(input.itemIds).size !== input.itemIds.length) {
    throw new ServiceError(
      '같은 옷을 중복해서 확인할 수 없습니다.',
      'DUPLICATE_WEAR_REMINDER_ITEM',
    )
  }
}

function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items]
  const [movedItem] = nextItems.splice(fromIndex, 1)
  if (movedItem === undefined) return items
  nextItems.splice(toIndex, 0, movedItem)
  return nextItems
}

function parseWeekAndDate(weekStartsOnValue: string, dateValue: string) {
  const weekStartsOn = parseDateOnly(weekStartsOnValue, '주 시작일')
  const date = parseDateOnly(dateValue)
  const dayOffset =
    (date.getTime() - weekStartsOn.getTime()) / (24 * 60 * 60 * 1000)

  if (!Number.isInteger(dayOffset) || dayOffset < 0 || dayOffset > 6) {
    throw new ServiceError(
      '선택한 날짜가 해당 주간에 포함되지 않습니다.',
      'DATE_OUTSIDE_PLANNER_WEEK',
    )
  }

  return { weekStartsOn, date, dayOffset }
}

export const plannerService = {
  /** 확인된 내 코디에만 추위·적정·더위 체감을 저장하거나 비운다. 미래·미확인·교체·재확인한 기록은 거절한다. */
  async setEntryWearFeeling(userId: string, input: SetPlannerEntryWearFeelingInput) {
    const { weekStartsOn, date } = parseWeekAndDate(input.weekStartsOn, input.date)
    if (!objectIdPattern.test(input.outfitId)) {
      throw new ServiceError('올바르지 않은 코디입니다.', 'INVALID_OUTFIT_ID')
    }
    const wornAt = new Date(input.wornAt)
    if (typeof input.wornAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.wornAt)
      || Number.isNaN(wornAt.getTime()) || wornAt.toISOString() !== input.wornAt) {
      throw new ServiceError('올바른 착용 확인 시각이 필요합니다.', 'INVALID_WEAR_CONFIRMATION')
    }
    if (input.feeling !== null && !['cold', 'comfortable', 'hot'].includes(input.feeling)) {
      throw new ServiceError('체감은 추웠어요·적당했어요·더웠어요 중에서 선택해주세요.', 'INVALID_WEAR_FEELING')
    }
    if (date > getKoreaTodayUtc()) {
      throw new ServiceError('미래 코디에는 체감을 기록할 수 없습니다.', 'FUTURE_PLANNER_WEAR')
    }
    const week = await plannerRepository.findWeek(userId, weekStartsOn)
    const entry = week?.entries.find((candidate) => candidate.date.getTime() === date.getTime())
    if (!week || !entry?.outfitId || !entry.outfit || entry.outfit.userId !== userId || entry.outfitId !== input.outfitId
      || !entry.wornAt || entry.wornAt.getTime() !== wornAt.getTime()) {
      throw new ServiceError('착용 완료한 현재 코디를 다시 확인해주세요.', 'PLANNER_WEAR_CHANGED')
    }
    const updatedWeek = await plannerRepository.setEntryWearFeeling(week.id, date, input.outfitId, wornAt, input.feeling)
    if (!updatedWeek) {
      throw new ServiceError('착용 기록이 변경됐습니다. 다시 확인해주세요.', 'PLANNER_WEAR_CHANGED')
    }
    return updatedWeek
  },
  /** 오늘 또는 지난 날짜의 내 배정을 실제 착용으로 확인하거나 취소한다. 배정 없는 날짜와 교체된 코디는 거절한다. */
  async setEntryWorn(userId: string, input: SetPlannerEntryWornInput) {
    const { weekStartsOn, date } = parseWeekAndDate(input.weekStartsOn, input.date)
    if (!objectIdPattern.test(input.outfitId)) {
      throw new ServiceError('올바르지 않은 코디입니다.', 'INVALID_OUTFIT_ID')
    }
    if (input.worn && date > getKoreaTodayUtc()) {
      throw new ServiceError('미래의 코디는 아직 착용 완료로 표시할 수 없습니다.', 'FUTURE_PLANNER_WEAR')
    }
    const week = await plannerRepository.findWeek(userId, weekStartsOn)
    const entry = week?.entries.find((candidate) => candidate.date.getTime() === date.getTime())
    if (!week || !entry?.outfitId || !entry.outfit || entry.outfit.userId !== userId || entry.outfitId !== input.outfitId) {
      throw new ServiceError('현재 날짜에 배정된 코디를 다시 확인해주세요.', 'PLANNER_OUTFIT_CHANGED')
    }
    const updatedWeek = await plannerRepository.setEntryWorn(week.id, date, input.outfitId, input.worn, new Date())
    if (!updatedWeek) {
      throw new ServiceError('코디가 변경됐습니다. 다시 확인해주세요.', 'PLANNER_OUTFIT_CHANGED')
    }
    return updatedWeek
  },
  getWeek(userId: string, weekStartsOnValue: string) {
    return plannerRepository.findWeek(
      userId,
      parseDateOnly(weekStartsOnValue, '주 시작일'),
    )
  },

  getEntries(userId: string, fromValue: string, toValue: string) {
    const from = parseDateOnly(fromValue, '조회 시작일')
    const to = parseDateOnly(toValue, '조회 종료일')
    const daySpan =
      (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)

    if (!Number.isInteger(daySpan) || daySpan < 0 || daySpan > 41) {
      throw new ServiceError(
        '플래너는 최대 42일까지 조회할 수 있습니다.',
        'INVALID_PLANNER_RANGE',
      )
    }

    return plannerRepository.findEntries(userId, from, to)
  },

  getOutfitWearHistory(userId: string, outfitIds: string[]) {
    const uniqueOutfitIds = [...new Set(outfitIds)]

    if (uniqueOutfitIds.some((outfitId) => !/^[a-f\d]{24}$/i.test(outfitId))) {
      throw new ServiceError(
        '올바르지 않은 코디가 포함되어 있습니다.',
        'INVALID_OUTFIT_ID',
      )
    }

    if (uniqueOutfitIds.length > 100) {
      throw new ServiceError(
        '코디 착용 기록은 한 번에 최대 100개까지 조회할 수 있습니다.',
        'OUTFIT_HISTORY_LIMIT_EXCEEDED',
      )
    }

    if (uniqueOutfitIds.length === 0) return []
    return plannerRepository.findOutfitWearHistory(userId, uniqueOutfitIds)
  },

  async getRecentWearConflict(
    userId: string,
    input: RecentWearConflictInput,
  ) {
    validateRecentWearConflictInput(input)
    const targetDate = parseDateOnly(input.targetDate, '착용 예정일')
    if (!input.combinationReminderEnabled && !input.itemReminderEnabled) {
      return null
    }

    const rangeStart = new Date(
      targetDate.getTime() - input.intervalDays * dayInMilliseconds,
    )
    const rangeEndExclusive = input.includeTargetDate
      ? new Date(targetDate.getTime() + dayInMilliseconds)
      : targetDate
    const throughDate = getKoreaTodayUtc()
    if (rangeStart.getTime() > throughDate.getTime()) return null

    const records = await plannerRepository.findRecentWearHistory(
      userId,
      input.itemIds,
      rangeStart,
      rangeEndExclusive,
      throughDate,
    )
    const conflict = findRecentWearConflict(records, input.itemIds, input)
    if (!conflict) return null

    return {
      ...conflict,
      wornDate: toDateOnly(conflict.wornDate),
    }
  },

  async setEntry(userId: string, input: SetPlannerEntryInput) {
    const { weekStartsOn, date } = parseWeekAndDate(
      input.weekStartsOn,
      input.date,
    )
    const outfit = await outfitRepository.findById(userId, input.outfitId)
    if (!outfit) {
      throw new ServiceError('코디를 찾을 수 없습니다.', 'OUTFIT_NOT_FOUND')
    }

    const currentWeek = await plannerRepository.findWeek(userId, weekStartsOn)
    const previousOutfit = currentWeek?.entries.find(
      (entry) => entry.date.getTime() === date.getTime(),
    )?.outfit
    const week =
      currentWeek ?? (await plannerRepository.upsertWeek(userId, weekStartsOn))
    const updatedWeek = await plannerRepository.setEntry({
      ...(date >= getKoreaTodayUtc() ? await wearWeatherRepository.getLocation(userId) : null),
      plannerWeekId: week.id,
      date,
      outfitId: outfit.id,
      title: input.title?.trim() || outfit.name,
      occasion: input.occasion?.trim() || null,
      weatherSummary: input.weatherSummary?.trim() || null,
      temperatureC: input.temperatureC,
    })
    if (previousOutfit?.plannerOnly && previousOutfit.id !== updatedWeek?.entries.find((entry) => entry.date.getTime() === date.getTime())?.outfitId) {
      await outfitService
        .remove(userId, previousOutfit.id)
        .catch(() => undefined)
    }
    return updatedWeek
  },

  async setDirectEntry(userId: string, input: SetDirectPlannerEntryInput) {
    const { weekStartsOn, date } = parseWeekAndDate(
      input.weekStartsOn,
      input.date,
    )
    const currentWeek = await plannerRepository.findWeek(userId, weekStartsOn)
    const previousOutfit = currentWeek?.entries.find(
      (entry) => entry.date.getTime() === date.getTime(),
    )?.outfit
    const outfit = await outfitService.preparePlannerOutfit(userId, {
      itemIds: input.itemIds,
      previewImage: input.previewImage,
      name: input.recommendationName ?? previousOutfit?.name,
      style: input.recommendationStyle ?? previousOutfit?.style,
      source: input.previewImage || input.recommendationStyle ? 'ai' : previousOutfit?.source,
    })
    const week =
      currentWeek ?? (await plannerRepository.upsertWeek(userId, weekStartsOn))

    const updatedWeek = await plannerRepository.setEntry({
      ...(date >= getKoreaTodayUtc() ? await wearWeatherRepository.getLocation(userId) : null),
      plannerWeekId: week.id,
      date,
      outfitData: outfit,
      title: outfit.name,
      weatherSummary: input.weatherSummary?.trim() || null,
      temperatureC: input.temperatureC,
    })
    if (previousOutfit?.plannerOnly && previousOutfit.id !== updatedWeek?.entries.find((entry) => entry.date.getTime() === date.getTime())?.outfitId) {
      await outfitService
        .remove(userId, previousOutfit.id)
        .catch(() => undefined)
    }
    return updatedWeek
  },

  savePlannerOutfitToLookbook(
    userId: string,
    outfitId: string,
    previewImage?: CreateOutfitInput['previewImage'],
  ) {
    return outfitService.copyPlannerOutfitToLookbook(userId, outfitId, previewImage)
  },

  async moveEntry(userId: string, input: MovePlannerEntryInput) {
    const source = parseWeekAndDate(input.weekStartsOn, input.sourceDate)
    const target = parseWeekAndDate(input.weekStartsOn, input.targetDate)

    if (source.date.getTime() === target.date.getTime()) {
      throw new ServiceError(
        '서로 다른 날짜를 선택해주세요.',
        'SAME_PLANNER_DATE',
      )
    }

    const week = await plannerRepository.findWeek(userId, source.weekStartsOn)
    if (!week) {
      throw new ServiceError(
        '옮길 플래너를 찾을 수 없습니다.',
        'PLANNER_WEEK_NOT_FOUND',
      )
    }

    const sourceEntry = week.entries.find(
      (entry) => entry.date.getTime() === source.date.getTime(),
    )
    if (!sourceEntry?.outfitId) {
      throw new ServiceError(
        '옮길 코디가 없습니다.',
        'PLANNER_OUTFIT_NOT_FOUND',
      )
    }

    const affectedStart = Math.min(source.dayOffset, target.dayOffset)
    const affectedEnd = Math.max(source.dayOffset, target.dayOffset)
    const affectedDates = Array.from(
      { length: affectedEnd - affectedStart + 1 },
      (_, index) => {
        const date = new Date(source.weekStartsOn)
        date.setDate(date.getDate() + affectedStart + index)
        return date
      },
    )
    const snapshots = affectedDates.map((date) => {
      const entry = week.entries.find(
        (candidate) => candidate.date.getTime() === date.getTime(),
      )
      return {
        outfitId: entry?.outfitId ?? null,
        title: entry?.title ?? null,
      }
    })
    const movedSnapshots = moveArrayItem(
      snapshots,
      source.dayOffset - affectedStart,
      target.dayOffset - affectedStart,
    )
    const today = getKoreaTodayUtc()
    const weatherLocation = affectedDates.some((date) => date >= today)
      ? await wearWeatherRepository.getLocation(userId)
      : null

    return plannerRepository.moveEntryOutfits({
      plannerWeekId: week.id,
      entries: affectedDates.map((date, index) => ({
        date,
        outfitId: movedSnapshots[index]?.outfitId ?? null,
        title: movedSnapshots[index]?.title ?? null,
        // 오늘 이후 날짜는 새 배정과 같이 현재 허용된 지역을 연결한다. 과거 날짜의 지역은 소급해서 바꾸지 않는다.
        ...(date >= today ? {
          weatherLatitude: weatherLocation?.weatherLatitude ?? null,
          weatherLongitude: weatherLocation?.weatherLongitude ?? null,
        } : {}),
      })),
    })
  },

  async clearEntry(userId: string, weekStartsOnValue: string, dateValue: string) {
    const { weekStartsOn, date } = parseWeekAndDate(
      weekStartsOnValue,
      dateValue,
    )
    const week = await plannerRepository.findWeek(userId, weekStartsOn)
    if (!week) return null
    const plannerOutfit = week.entries.find(
      (entry) => entry.date.getTime() === date.getTime(),
    )?.outfit
    const updatedWeek = await plannerRepository.clearEntry(week.id, date)
    if (plannerOutfit?.plannerOnly) {
      await outfitService.remove(userId, plannerOutfit.id)
    }
    return updatedWeek
  },
}
