import type { OutfitStyle } from '@prisma/client'
import { ServiceError } from '../../graphql/errors.js'
import { parseDateOnly } from '../../lib/date.js'
import { outfitRepository } from '../outfit/outfit.repository.js'
import {
  outfitService,
  type CreateOutfitInput,
} from '../outfit/outfit.service.js'
import { plannerRepository } from './planner.repository.js'

export interface SetPlannerEntryInput {
  weekStartsOn: string
  date: string
  outfitId: string
  title?: string | null
  occasion?: string | null
  weatherSummary?: string | null
  temperatureC?: number | null
}

export interface SetDirectPlannerEntryInput {
  weekStartsOn: string
  date: string
  itemIds: string[]
  previewImage?: CreateOutfitInput['previewImage']
  recommendationName?: string | null
  recommendationStyle?: OutfitStyle | null
}

export interface MovePlannerEntryInput {
  weekStartsOn: string
  sourceDate: string
  targetDate: string
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
      plannerWeekId: week.id,
      date,
      outfitId: outfit.id,
      title: input.title?.trim() || outfit.name,
      occasion: input.occasion?.trim() || null,
      weatherSummary: input.weatherSummary?.trim() || null,
      temperatureC: input.temperatureC,
    })
    if (previousOutfit?.plannerOnly && previousOutfit.id !== outfit.id) {
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
    const uniqueItemIds = [...new Set(input.itemIds)]
    const duplicate =
      uniqueItemIds.length >= 2 && uniqueItemIds.length === input.itemIds.length
        ? await outfitService.findSavedDuplicate(
            userId,
            uniqueItemIds,
            undefined,
            input.recommendationStyle
              ? { style: input.recommendationStyle, source: 'ai' }
              : undefined,
          )
        : undefined
    const createdPlannerOnly = !duplicate
    const outfit = duplicate
      ? input.previewImage
        ? await outfitService.addPreview(
            userId,
            duplicate.id,
            input.previewImage,
          )
        : duplicate
      : await outfitService.createPlannerOnly(userId, {
          itemIds: input.itemIds,
          previewImage: input.previewImage,
          name: input.recommendationName,
          style: input.recommendationStyle,
          source: input.recommendationStyle ? 'ai' : undefined,
        })
    const week =
      currentWeek ?? (await plannerRepository.upsertWeek(userId, weekStartsOn))

    let updatedWeek
    try {
      updatedWeek = await plannerRepository.setEntry({
        plannerWeekId: week.id,
        date,
        outfitId: outfit.id,
        title: outfit.name,
      })
    } catch (error) {
      if (createdPlannerOnly) {
        await outfitService.remove(userId, outfit.id).catch(() => undefined)
      }
      throw error
    }

    if (previousOutfit?.plannerOnly && previousOutfit.id !== outfit.id) {
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
    return outfitService.promotePlannerOutfit(userId, outfitId, previewImage)
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

    return plannerRepository.moveEntryOutfits({
      plannerWeekId: week.id,
      entries: affectedDates.map((date, index) => ({
        date,
        outfitId: movedSnapshots[index]?.outfitId ?? null,
        title: movedSnapshots[index]?.title ?? null,
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
