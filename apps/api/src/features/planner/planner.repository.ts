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
}
