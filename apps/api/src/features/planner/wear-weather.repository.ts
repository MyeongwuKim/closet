import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { confirmedWearWhere } from './planner-wear.js'

export interface WearWeatherLocation {
  latitude: number
  longitude: number
}

/** 지난 날짜의 미기록 일정을 찾는 인덱스를 준비한다. 기존 일정 데이터는 변경하지 않는다. */
export async function ensureWearWeatherStorage() {
  await prisma.$runCommandRaw({ createIndexes: 'PlannerEntry', indexes: [{ key: { date: 1, wearWeatherRetryAt: 1 }, name: 'wear_weather_pending' }] })
}

const missingTemperature = {
  OR: [{ wearTemperatureC: null }, { wearTemperatureC: { isSet: false } }],
} satisfies Prisma.PlannerEntryWhereInput

function readyForRetry(now: Date): Prisma.PlannerEntryWhereInput {
  return { OR: [{ wearWeatherRetryAt: null }, { wearWeatherRetryAt: { isSet: false } }, { wearWeatherRetryAt: { lte: now } }] }
}

/** 계정의 마지막 날씨 지역과 날짜별 기록을 관리한다. 지난 기록의 지역·기온은 새 위치로 덮어쓰지 않는다. */
export const wearWeatherRepository = {
  /** 계정에 저장된 마지막 날씨 지역을 읽고, 위치 기록이 없으면 null을 반환한다. */
  async getLocation(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { wearWeatherLatitude: true, wearWeatherLongitude: true } })
    if (typeof user?.wearWeatherLatitude !== 'number' || typeof user.wearWeatherLongitude !== 'number') return null
    return { weatherLatitude: user.wearWeatherLatitude, weatherLongitude: user.wearWeatherLongitude }
  },

  /** 위치 변경·사용 해제를 계정과 오늘 이후 일정에 함께 반영한다. 이미 지난 날짜의 지역은 유지한다. */
  async saveLocation(userId: string, location: WearWeatherLocation | null, today: Date) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { wearWeatherLatitude: location?.latitude ?? null, wearWeatherLongitude: location?.longitude ?? null } }),
      prisma.plannerEntry.updateMany({
        where: { plannerWeek: { is: { userId } }, date: { gte: today } },
        data: { weatherLatitude: location?.latitude ?? null, weatherLongitude: location?.longitude ?? null },
      }),
    ])
  },

  /** 실제 착용을 확인한 지난 일정 중 기온이 없고 재시도 시각에 도달한 기록만 읽는다. */
  pending(today: Date, now: Date) {
    return prisma.plannerEntry.findMany({
      where: { ...confirmedWearWhere, date: { lt: today }, outfitId: { not: null }, weatherLatitude: { not: null }, weatherLongitude: { not: null }, AND: [missingTemperature, readyForRetry(now)] },
      select: { id: true, date: true, wornAt: true, outfitId: true, weatherLatitude: true, weatherLongitude: true },
      orderBy: { date: 'desc' }, take: 12,
    })
  },

  /** 여러 서버가 같은 기록을 동시에 처리하지 않도록 재시도 시각을 한 시간 뒤로 예약한다. */
  async claim(id: string, now: Date) {
    const result = await prisma.plannerEntry.updateMany({ where: { id, ...confirmedWearWhere, outfitId: { not: null }, AND: [missingTemperature, readyForRetry(now)] }, data: { wearWeatherRetryAt: new Date(now.getTime() + 60 * 60_000) } })
    return result.count === 1
  },

  /** 조회 중 삭제·재배정·지역 변경·착용 취소가 발생하면 저장하지 않는다. 다시 확인한 일정도 이전 작업의 결과와 구분한다. */
  async record(entry: { id: string; outfitId: string | null; date: Date; wornAt: Date | null; weatherLatitude: number | null; weatherLongitude: number | null }, temperatureC: number, now: Date) {
    if (!entry.wornAt) return false
    const result = await prisma.plannerEntry.updateMany({
      where: { id: entry.id, outfitId: entry.outfitId, date: entry.date, wornAt: entry.wornAt, weatherLatitude: entry.weatherLatitude, weatherLongitude: entry.weatherLongitude, ...missingTemperature },
      data: { wearTemperatureC: temperatureC, wearWeatherRecordedAt: now, wearWeatherRetryAt: null },
    })
    return result.count === 1
  },
}
