import { prisma } from '../../lib/prisma.js'
import { confirmedWearWhere } from '../planner/planner-wear.js'
import { THERMAL_RECOMMENDATION_HISTORY_DAYS, THERMAL_RECOMMENDATION_SAMPLE_LIMIT, THERMAL_RECOMMENDATION_TEMPERATURE_WINDOW_C } from './thermal-recommendation.rules.js'

export const thermalRecommendationRepository = {
  /** 본인 소유의 확인된 지난 착용 중 실제 일평균·체감이 있고 예보 일평균과 가까운 최신 기록만 읽는다. */
  findHistory(userId: string, targetDate: Date, today: Date, meanTemperatureC: number) {
    return prisma.plannerEntry.findMany({
      where: {
        ...confirmedWearWhere,
        plannerWeek: { is: { userId } },
        outfitId: { not: null },
        date: {
          gte: new Date(today.getTime() - THERMAL_RECOMMENDATION_HISTORY_DAYS * 86_400_000),
          lt: targetDate < today ? targetDate : today,
        },
        wearFeeling: { in: ['cold', 'comfortable', 'hot'] },
        wearTemperatureC: {
          gte: meanTemperatureC - THERMAL_RECOMMENDATION_TEMPERATURE_WINDOW_C,
          lte: meanTemperatureC + THERMAL_RECOMMENDATION_TEMPERATURE_WINDOW_C,
        },
      },
      select: { id: true, date: true, wornAt: true, wearFeeling: true, wearTemperatureC: true },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: THERMAL_RECOMMENDATION_SAMPLE_LIMIT,
    })
  },
}
