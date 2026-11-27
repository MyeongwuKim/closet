import type { TemperatureWearHistoryInput, TemperatureWearRecord } from '@closet/types'
import { ServiceError } from '../../graphql/errors.js'
import { toDateOnly } from '../../lib/date.js'
import { makePage, readPageInput } from '../../lib/pagination.js'
import { outfitCompositionKey } from '../outfit/outfit-composition.js'
import { getKoreaTodayUtc } from '../wardrobe/wardrobe.service.js'
import { temperatureHistoryRepository } from './temperature-history.repository.js'

function validateInput(input: TemperatureWearHistoryInput) {
  const { minTemperatureC: min, maxTemperatureC: max } = input
  for (const value of [min, max]) {
    if (value != null && (!Number.isFinite(value) || value < -100 || value > 100)) {
      throw new ServiceError('기온은 -100℃에서 100℃ 사이로 골라주세요.', 'INVALID_TEMPERATURE_RANGE')
    }
  }
  if ((min != null && max != null && min >= max) || (input.unrecordedOnly && (min != null || max != null))) {
    throw new ServiceError('기온 범위를 다시 골라주세요.', 'INVALID_TEMPERATURE_RANGE')
  }
  if (input.feeling != null && !['cold', 'comfortable', 'hot'].includes(input.feeling)) {
    throw new ServiceError('체감 조건을 다시 골라주세요.', 'INVALID_WEAR_FEELING')
  }
}

function matches(record: TemperatureWearRecord, input: TemperatureWearHistoryInput) {
  if (input.feeling && record.feeling !== input.feeling) return false
  if (input.unrecordedOnly) return record.temperatureC === null
  if (input.minTemperatureC == null && input.maxTemperatureC == null) return true
  return record.temperatureC !== null
    && (input.minTemperatureC == null || record.temperatureC >= input.minTemperatureC)
    && (input.maxTemperatureC == null || record.temperatureC < input.maxTemperatureC)
}

/**
 * 같은 옷 ID 집합의 확인된 착용을 한 카드로 묶고, 조건에 맞는 가장 최근 날짜 순으로 페이지를 만든다.
 * 조건을 고르더라도 각 카드의 전체 날짜별 기온·체감은 보존한다. 사진은 페이지에 든 날짜 복사본에서 읽는다.
 */
export async function getTemperatureWearHistory(userId: string, input: TemperatureWearHistoryInput = {}) {
  validateInput(input)
  const page = readPageInput({ ...input, sort: input.outfitFilter?.sort })
  const today = getKoreaTodayUtc()
  const entries = await temperatureHistoryRepository.findRecords(userId, today, input)
  const composition = input.compositionItemIds?.length ? outfitCompositionKey(input.compositionItemIds) : null
  const groups = new Map<string, { id: string; createdAt: Date; matchingDate: string; records: TemperatureWearRecord[] }>()
  for (const entry of entries) {
    if (!entry.outfit || !entry.wornAt || entry.date > today) continue
    const key = outfitCompositionKey(entry.outfit.items.map(item => item.wardrobeItemId))
    if (!key || (composition && key !== composition)) continue
    const automaticTemperatureC = Number.isFinite(entry.wearTemperatureC) ? entry.wearTemperatureC : null
    const forecastTemperatureC = Number.isFinite(entry.wearForecastTemperatureC) ? entry.wearForecastTemperatureC : null
    const manualTemperatureC = Number.isFinite(entry.manualWearTemperatureC) ? entry.manualWearTemperatureC : null
    const record: TemperatureWearRecord = {
      date: toDateOnly(entry.date),
      outfitId: entry.outfit.id,
      wornAt: entry.wornAt.toISOString(),
      temperatureC: manualTemperatureC ?? automaticTemperatureC ?? forecastTemperatureC,
      automaticTemperatureC,
      forecastTemperatureC,
      manualTemperatureC,
      feeling: entry.wearFeeling ?? null,
    }
    let group = groups.get(key)
    if (!group) {
      group = { id: '', createdAt: new Date(0), matchingDate: '', records: [] }
      groups.set(key, group)
    }
    group.records.push(record)
    if (matches(record, input) && (record.date > group.matchingDate || (record.date === group.matchingDate && entry.outfit.id > group.id))) {
      group.id = entry.outfit.id
      group.createdAt = entry.date
      group.matchingDate = record.date
    }
  }
  const sorted = [...groups.values()].filter(group => group.id).sort((a, b) => {
    const recentFirst = b.matchingDate.localeCompare(a.matchingDate) || b.id.localeCompare(a.id)
    return page.order === 'asc' ? -recentFirst : recentFirst
  })
  let offset = 0
  if (input.cursor) {
    // readPageInput가 검증한 커서라도 기록이 취소·교체되었다면 첫 페이지에서 다시 시작한다.
    const boundary = JSON.parse(Buffer.from(input.cursor, 'base64url').toString()) as { id: string; createdAt: string }
    const index = sorted.findIndex(group => group.id === boundary.id && group.createdAt.toISOString() === boundary.createdAt)
    if (index < 0) throw new ServiceError('착용 기록이 바뀌었어요. 목록을 처음부터 다시 불러와주세요.', 'INVALID_CURSOR')
    offset = index + 1
  }
  const result = makePage(sorted.slice(offset, offset + page.limit + 1), sorted.length, page)
  const outfits = result.items.length ? await temperatureHistoryRepository.findOutfits(userId, result.items.map(group => group.id)) : []
  const byId = new Map(outfits.map(outfit => [outfit.id, outfit]))
  return {
    ...result,
    items: result.items.flatMap(group => {
      const outfit = byId.get(group.id)
      return outfit ? [{ ...group, outfit, records: group.records.sort((a, b) => b.date.localeCompare(a.date)) }] : []
    }),
  }
}
