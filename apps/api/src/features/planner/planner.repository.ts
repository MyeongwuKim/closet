/**
 * 용도:
 * 플래너 주간 일정과 코디 착용 이력을 Prisma로 조회하고 저장한다.
 *
 * 동작 방식:
 * 사용자와 날짜 범위를 기준으로 일정을 찾고, 최근 착용 검사는
 * 이미지 없이 코디명과 아이템 구성만 가볍게 조회한다.
 */

import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { outfitInclude } from '../outfit/outfit.repository.js'

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
  outfitId: string
  title?: string | null
  occasion?: string | null
  weatherSummary?: string | null
  temperatureC?: number | null
}

interface PlannerEntryOutfitSnapshot {
  date: Date
  outfitId: string | null
  title: string | null
}

interface MovePlannerEntryData {
  plannerWeekId: string
  entries: PlannerEntryOutfitSnapshot[]
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

  findOutfitWearHistory(userId: string, outfitIds: string[]) {
    return prisma.plannerEntry.findMany({
      where: {
        outfitId: { in: outfitIds },
        plannerWeek: { is: { userId } },
      },
      select: {
        outfitId: true,
        date: true,
      },
      orderBy: { date: 'desc' },
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

  async setEntry(data: SetPlannerEntryData) {
    await prisma.plannerEntry.upsert({
      where: {
        plannerWeekId_date: {
          plannerWeekId: data.plannerWeekId,
          date: data.date,
        },
      },
      update: {
        outfitId: data.outfitId,
        title: data.title,
        occasion: data.occasion,
        weatherSummary: data.weatherSummary,
        temperatureC: data.temperatureC,
      },
      create: data,
    })

    return prisma.plannerWeek.findUnique({
      where: { id: data.plannerWeekId },
      include: plannerWeekInclude,
    })
  },

  async clearEntry(plannerWeekId: string, date: Date) {
    await prisma.plannerEntry.updateMany({
      where: { plannerWeekId, date },
      data: { outfitId: null, title: null },
    })

    return prisma.plannerWeek.findUnique({
      where: { id: plannerWeekId },
      include: plannerWeekInclude,
    })
  },

  async moveEntryOutfits(data: MovePlannerEntryData) {
    await prisma.$transaction(
      data.entries.map((entry) =>
        prisma.plannerEntry.upsert({
          where: {
            plannerWeekId_date: {
              plannerWeekId: data.plannerWeekId,
              date: entry.date,
            },
          },
          update: {
            outfitId: entry.outfitId,
            title: entry.title,
          },
          create: {
            plannerWeekId: data.plannerWeekId,
            date: entry.date,
            outfitId: entry.outfitId,
            title: entry.title,
          },
        }),
      ),
    )

    return prisma.plannerWeek.findUnique({
      where: { id: data.plannerWeekId },
      include: plannerWeekInclude,
    })
  },
}
