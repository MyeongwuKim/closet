/**
 * 용도:
 * 플래너 주간 일정과 코디 착용 이력을 Prisma로 조회하고 저장한다.
 *
 * 동작 방식:
 * 사용자와 날짜 범위를 기준으로 일정을 찾고, 최근 착용 검사는
 * 이미지 없이 확인된 코디명과 아이템 구성만 조회한다. 코디 배정 이력에는 착용 확인 시각과 기온도 포함한다.
 */

import type { Prisma, WearFeeling } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { outfitInclude, type CreateOutfitData } from '../outfit/outfit.repository.js'
import { createOutfitSnapshot, outfitSnapshotData, sameOutfitSnapshot, sameWornItems } from '../outfit/planner-outfit-snapshot.js'
import { confirmedWearWhere } from './planner-wear.js'
import { ServiceError } from '../../graphql/errors.js'
import { aiTransaction } from '../../lib/ai/ai-storage.js'
import { lockGeneratedImageForReference } from '../image/image.repository.js'
import { outfitCompositionKey } from '../outfit/outfit-composition.js'
import { lockWardrobeItemsForReference } from '../wardrobe/wardrobe-image-lifecycle.js'

export const plannerWeekInclude = {
  entries: {
    include: {
      outfit: { include: outfitInclude },
    },
    orderBy: { date: 'asc' as const },
  },
} satisfies Prisma.PlannerWeekInclude

export interface SetPlannerEntryData {
  plannerWeekId: string
  date: Date
  outfitId?: string
  /** 직접 선택한 옷은 원본 코디를 만들기 전에 날짜 복사본으로 함께 저장한다. */
  outfitData?: CreateOutfitData
  title?: string | null
  occasion?: string | null
  weatherSummary?: string | null
  temperatureC?: number | null
  weatherLatitude?: number | null
  weatherLongitude?: number | null
}

interface PlannerEntryOutfitSnapshot {
  date: Date
  outfitId: string | null
  title: string | null
  /** 오늘 이후 이동에 사용할 현재 지역. undefined면 해당 날짜에 남아 있는 과거 지역을 유지한다. */
  weatherLatitude?: number | null
  weatherLongitude?: number | null
}

interface MovePlannerEntryData {
  plannerWeekId: string
  entries: PlannerEntryOutfitSnapshot[]
}

const clearedWearData = {
  wornAt: null,
  wearFeeling: null,
  wearTemperatureC: null,
  wearWeatherRecordedAt: null,
  wearWeatherRetryAt: null,
} as const

/** 옷 사진은 전용 잠금, 생성 사진은 자산 잠금을 정리 배치와 공유해 일정 이동 중 파일이 삭제되지 않게 한다. */
async function lockPlannerOutfitImages(transaction: Prisma.TransactionClient, plannerWeekId: string, outfitIds: string[]) {
  const uniqueIds = [...new Set(outfitIds)]
  if (uniqueIds.length === 0) return
  const week = await transaction.plannerWeek.findUnique({ where: { id: plannerWeekId }, select: { userId: true } })
  if (!week) throw new ServiceError('플래너를 찾을 수 없습니다.', 'PLANNER_NOT_FOUND')
  const outfits = await transaction.outfit.findMany({
    where: { id: { in: uniqueIds }, userId: week.userId },
    select: { id: true, items: { select: { wardrobeItemId: true } }, generations: { select: { imageAssetId: true } } },
  })
  if (outfits.length !== uniqueIds.length) throw new ServiceError('플래너에 연결할 코디를 찾을 수 없습니다.', 'OUTFIT_NOT_FOUND')
  await lockWardrobeItemsForReference(transaction, week.userId, outfits.flatMap((outfit) => outfit.items.map((item) => item.wardrobeItemId)), { allowArchived: true })
  const assetIds = [...new Set(outfits.flatMap((outfit) => outfit.generations.flatMap((generation) => generation.imageAssetId ? [generation.imageAssetId] : [])))]
  for (const assetId of assetIds) await lockGeneratedImageForReference(transaction, week.userId, assetId)
}

export const plannerRepository = {
  findWeek(userId: string, weekStartsOn: Date) {
    return prisma.plannerWeek.findUnique({
      where: { userId_weekStartsOn: { userId, weekStartsOn } },
      include: plannerWeekInclude,
    })
  },

  findEntries(userId: string, from: Date, to: Date) {
    return prisma.plannerEntry.findMany({
      where: {
        date: { gte: from, lte: to },
        plannerWeek: { is: { userId } },
      },
      include: {
        outfit: { include: outfitInclude },
      },
      orderBy: { date: 'asc' },
    })
  },

  /** 현재 본인 코디의 옷 조합과 정확히 같은 날짜별 복사본을 연결한다. 예정·미착용도 반환하고 응답 ID는 요청한 코디 ID를 유지한다. */
  async findOutfitWearHistory(userId: string, outfitIds: string[]) {
    if (outfitIds.length === 0) return []
    const outfits = await prisma.outfit.findMany({
      where: { userId, id: { in: [...new Set(outfitIds)] } },
      select: { id: true, items: { select: { wardrobeItemId: true } } },
    })
    const matchingIds = new Map<string, string[]>()
    for (const outfit of outfits) {
      const composition = outfitCompositionKey(outfit.items.map((item) => item.wardrobeItemId))
      if (composition) matchingIds.set(composition, [...(matchingIds.get(composition) ?? []), outfit.id])
    }
    if (matchingIds.size === 0) return []
    const itemIds = [...new Set(outfits.flatMap((outfit) => outfit.items.map((item) => item.wardrobeItemId)))]
    const entries = await prisma.plannerEntry.findMany({
      where: {
        outfitId: { not: null },
        plannerWeek: { is: { userId } },
        outfit: { is: { userId, items: { some: { wardrobeItemId: { in: itemIds } } } } },
      },
      select: {
        date: true,
        wornAt: true,
        wearTemperatureC: true,
        outfit: { select: { items: { select: { wardrobeItemId: true } } } },
      },
      orderBy: { date: 'desc' },
    })
    return entries.flatMap((entry) => {
      const composition = outfitCompositionKey(entry.outfit?.items.map((item) => item.wardrobeItemId) ?? [])
      return (matchingIds.get(composition) ?? []).map((outfitId) => ({
        outfitId, date: entry.date, wornAt: entry.wornAt, wearTemperatureC: entry.wearTemperatureC,
      }))
    })
  },

  findRecentWearHistory(
    userId: string,
    itemIds: string[],
    rangeStart: Date,
    rangeEndExclusive: Date,
    throughDate: Date,
  ) {
    return prisma.plannerEntry.findMany({
      where: {
        ...confirmedWearWhere,
        date: {
          gte: rangeStart,
          lt: rangeEndExclusive,
          lte: throughDate,
        },
        outfitId: { not: null },
        plannerWeek: { is: { userId } },
        outfit: {
          is: {
            items: {
              some: { wardrobeItemId: { in: itemIds } },
            },
          },
        },
      },
      select: {
        date: true,
        wornAt: true,
        outfit: {
          select: {
            name: true,
            items: {
              select: {
                wardrobeItemId: true,
                slot: true,
              },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
    })
  },

  upsertWeek(userId: string, weekStartsOn: Date) {
    return prisma.plannerWeek.upsert({
      where: { userId_weekStartsOn: { userId, weekStartsOn } },
      update: {},
      create: { userId, weekStartsOn },
    })
  },

  /** 원본과 별도인 날짜 코디를 생성·연결한다. 같은 옷의 사진·이름 변경은 착용 기록을 유지한다. */
  async setEntry(data: SetPlannerEntryData) {
    return aiTransaction(async (transaction) => {
      const week = await transaction.plannerWeek.findUnique({ where: { id: data.plannerWeekId }, select: { userId: true } })
      if (!week) throw new ServiceError('플래너를 찾을 수 없습니다.', 'PLANNER_NOT_FOUND')
      const where = {
        plannerWeekId_date: { plannerWeekId: data.plannerWeekId, date: data.date },
      }
      const previous = await transaction.plannerEntry.findUnique({ where, include: { outfit: { include: outfitInclude } } })
      const source = data.outfitId ? await transaction.outfit.findFirst({ where: { id: data.outfitId, userId: week.userId }, include: outfitInclude }) : null
      if (!data.outfitData && !source) throw new ServiceError('플래너에 연결할 코디를 찾을 수 없습니다.', 'OUTFIT_NOT_FOUND')
      const snapshotData = data.outfitData ? { ...data.outfitData } : outfitSnapshotData(source!)
      if (snapshotData.userId !== week.userId) throw new ServiceError('내 코디만 플래너에 저장할 수 있습니다.', 'OUTFIT_NOT_FOUND')
      const previousData = previous?.outfit ? outfitSnapshotData(previous.outfit) : null
      const sameItems = Boolean(previousData && sameWornItems(previousData, snapshotData))
      if (data.outfitData && sameItems && !snapshotData.generation) snapshotData.generation = previousData?.generation
      // 원본 수정·삭제와 날짜 복사가 겹치면 같은 코디 행에 대한 충돌 재시도로 최신 상태를 다시 읽는다.
      if (source) await transaction.outfit.update({ where: { id: source.id }, data: { updatedAt: new Date() } })
      const canReuse = previous?.outfit?.plannerOnly && previousData && sameOutfitSnapshot(previousData, snapshotData)
        && await transaction.plannerEntry.count({ where: { outfitId: previous.outfitId } }) === 1
      const copy = canReuse ? previous!.outfit! : await createOutfitSnapshot(transaction, snapshotData, true, { allowArchived: !data.outfitData })
      const { outfitId: _sourceId, outfitData: _snapshotData, ...entryData } = data
      await transaction.plannerEntry.upsert({
        where,
        update: {
          outfitId: copy.id,
          title: data.title,
          occasion: data.occasion,
          weatherSummary: data.weatherSummary,
          temperatureC: data.temperatureC,
          weatherLatitude: data.weatherLatitude,
          weatherLongitude: data.weatherLongitude,
          ...(!sameItems ? {
            ...clearedWearData,
            weatherLatitude: data.weatherLatitude ?? null,
            weatherLongitude: data.weatherLongitude ?? null,
          } : {}),
        },
        create: { ...entryData, outfitId: copy.id, wornAt: null, wearFeeling: null },
      })

      return transaction.plannerWeek.findUnique({
        where: { id: data.plannerWeekId },
        include: plannerWeekInclude,
      })
    })
  },

  /** 읽었던 코디가 여전히 해당 날짜에 있을 때만 착용 상태를 저장한다. 이미 같은 상태라면 확인 시각을 유지한다. */
  async setEntryWorn(plannerWeekId: string, date: Date, outfitId: string, worn: boolean, confirmedAt: Date) {
    return prisma.$transaction(async (transaction) => {
      const entry = await transaction.plannerEntry.findUnique({
        where: { plannerWeekId_date: { plannerWeekId, date } },
        select: { id: true, outfitId: true, wornAt: true },
      })
      if (!entry || entry.outfitId !== outfitId) return null
      if (Boolean(entry.wornAt) !== worn) {
        await transaction.plannerEntry.update({
          where: { id: entry.id },
          data: worn ? { wornAt: confirmedAt, wearFeeling: null } : clearedWearData,
        })
      }
      return transaction.plannerWeek.findUnique({ where: { id: plannerWeekId }, include: plannerWeekInclude })
    })
  },

  /** 코디와 착용 확인 시각이 모두 그대로인 기록의 체감만 저장한다. 같은 체감은 다시 쓰지 않고 null은 선택을 비운다. */
  async setEntryWearFeeling(plannerWeekId: string, date: Date, outfitId: string, wornAt: Date, feeling: WearFeeling | null) {
    return prisma.$transaction(async (transaction) => {
      const entry = await transaction.plannerEntry.findUnique({
        where: { plannerWeekId_date: { plannerWeekId, date } },
        select: { id: true, outfitId: true, wornAt: true, wearFeeling: true },
      })
      if (!entry || entry.outfitId !== outfitId || !entry.wornAt || entry.wornAt.getTime() !== wornAt.getTime()) return null
      if ((entry.wearFeeling ?? null) !== feeling) {
        const updated = await transaction.plannerEntry.updateMany({
          where: { id: entry.id, outfitId, wornAt },
          data: { wearFeeling: feeling },
        })
        if (updated.count !== 1) return null
      }
      return transaction.plannerWeek.findUnique({ where: { id: plannerWeekId }, include: plannerWeekInclude })
    })
  },

  async clearEntry(plannerWeekId: string, date: Date) {
    await prisma.plannerEntry.updateMany({
      where: { plannerWeekId, date },
      data: { outfitId: null, title: null, ...clearedWearData },
    })

    return prisma.plannerWeek.findUnique({
      where: { id: plannerWeekId },
      include: plannerWeekInclude,
    })
  },

  /** 날짜별 코디를 이동하고 바뀐 배정의 착용을 초기화한다. 전달된 지역은 갱신하고 새 과거 날짜에는 지역을 추정하지 않는다. */
  async moveEntryOutfits(data: MovePlannerEntryData) {
    return aiTransaction(async (transaction) => {
      await lockPlannerOutfitImages(transaction, data.plannerWeekId, data.entries.flatMap((entry) => entry.outfitId ? [entry.outfitId] : []))
      const previousEntries = await transaction.plannerEntry.findMany({
        where: { plannerWeekId: data.plannerWeekId, date: { in: data.entries.map((entry) => entry.date) } },
        select: { date: true, outfitId: true },
      })
      await Promise.all(data.entries.map((entry) => {
        const previous = previousEntries.find((candidate) => candidate.date.getTime() === entry.date.getTime())
        return transaction.plannerEntry.upsert({
          where: {
            plannerWeekId_date: {
              plannerWeekId: data.plannerWeekId,
              date: entry.date,
            },
          },
          update: {
            outfitId: entry.outfitId,
            title: entry.title,
            weatherLatitude: entry.weatherLatitude,
            weatherLongitude: entry.weatherLongitude,
            ...(previous?.outfitId !== entry.outfitId ? clearedWearData : {}),
          },
          create: {
            plannerWeekId: data.plannerWeekId,
            date: entry.date,
            outfitId: entry.outfitId,
            title: entry.title,
            weatherLatitude: entry.weatherLatitude ?? null,
            weatherLongitude: entry.weatherLongitude ?? null,
            wornAt: null,
            wearFeeling: null,
          },
        })
      }))

      return transaction.plannerWeek.findUnique({
        where: { id: data.plannerWeekId },
        include: plannerWeekInclude,
      })
    })
  },
}
