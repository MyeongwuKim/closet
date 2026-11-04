import type { ClothingCategory } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { getImageDeliveryUrl } from '../image/image.service.js'
import { getKoreaTodayUtc, getWardrobeWearStats } from '../wardrobe/wardrobe.service.js'
import { activeWardrobeWhere, categoryLabels, savedOutfitWhere, styleLabels } from './catalog.service.js'
import { confirmedWearWhere } from '../planner/planner-wear.js'
import { outfitCompositionKey } from '../outfit/outfit-composition.js'

interface InventoryItem {
  id: string
  name: string
  category: ClothingCategory | null
  colorName: string | null
  colorHex: string | null
}
interface WearRecord {
  date: Date
  wornAt?: Date | null
  outfit: { id: string; style: string; items: Array<{ wardrobeItemId: string }> } | null
}
interface SavedOutfit { id: string; name: string; items: Array<{ wardrobeItemId: string }> }
interface Bucket { key: string; label: string; count: number; color: string | null }

/** 오늘까지 확인한 날짜별 복사본으로 전체 착용을 집계하고, 코디북 순위는 현재 옷 구성이 같은 착용 날짜만 연결한다. */
export function summarizeWardrobe(items: InventoryItem[], records: WearRecord[], throughDate: Date, savedOutfits: SavedOutfit[] = []) {
  const pastRecords = records.filter((record) => record.wornAt && Number.isFinite(record.wornAt.getTime()) && record.date <= throughDate && record.outfit)
  const wear = getWardrobeWearStats(pastRecords)
  const categories = new Map<string, Bucket>()
  const colors = new Map<string, Bucket>()
  const styles = new Map<string, Bucket>()
  const add = (map: Map<string, Bucket>, key: string, label: string, color: string | null = null) => {
    const entry = map.get(key)
    map.set(key, { key, label, color: entry?.color ?? color, count: (entry?.count ?? 0) + 1 })
  }
  for (const item of items) {
    add(categories, item.category ?? 'unclassified', item.category ? categoryLabels[item.category] : '미분류')
    const color = item.colorName?.trim() || '미지정'
    add(colors, color, color, item.colorHex)
  }
  const wornOutfits = new Set<string>()
  const compositionWearDates = new Map<string, Set<string>>()
  for (const record of pastRecords) {
    const outfit = record.outfit!
    const key = `${outfit.id}:${record.date.toISOString().slice(0, 10)}`
    if (wornOutfits.has(key)) continue
    wornOutfits.add(key)
    const composition = outfitCompositionKey(outfit.items.map((item) => item.wardrobeItemId))
    if (composition) {
      const dates = compositionWearDates.get(composition) ?? new Set<string>()
      dates.add(record.date.toISOString().slice(0, 10))
      compositionWearDates.set(composition, dates)
    }
    add(styles, outfit.style, styleLabels[outfit.style] ?? outfit.style)
  }
  const savedWearCount = (outfit: SavedOutfit) => compositionWearDates.get(outfitCompositionKey(outfit.items.map((item) => item.wardrobeItemId)))?.size ?? 0
  const ranked = (map: Map<string, Bucket>) => [...map.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ko'))
  return {
    totalItems: items.length,
    wearRecordCount: wornOutfits.size,
    unwornCount: items.filter((item) => !wear.has(item.id)).length,
    unwornOutfitCount: savedOutfits.filter((outfit) => savedWearCount(outfit) === 0).length,
    categories: ranked(categories), colors: ranked(colors), wornStyles: ranked(styles),
    mostWorn: items.map((item) => ({ id: item.id, name: item.name, wearCount: wear.get(item.id)?.wearCount ?? 0 }))
      .filter((item) => item.wearCount > 0)
      .sort((a, b) => b.wearCount - a.wearCount || a.name.localeCompare(b.name, 'ko') || a.id.localeCompare(b.id))
      .slice(0, 5),
    mostWornOutfits: savedOutfits.map((outfit) => ({ id: outfit.id, name: outfit.name, wearCount: savedWearCount(outfit) }))
      .filter((outfit) => outfit.wearCount > 0)
      .sort((a, b) => b.wearCount - a.wearCount || a.name.localeCompare(b.name, 'ko') || a.id.localeCompare(b.id))
      .slice(0, 5),
  }
}

const imageAssetSelect = { deliveryUrl: true, cloudflareImageId: true } as const
function imageUrl(asset: { deliveryUrl: string | null; cloudflareImageId: string } | null | undefined) {
  return asset ? asset.deliveryUrl ?? getImageDeliveryUrl(asset.cloudflareImageId) : null
}

export const statisticsService = {
  async get(userId: string) {
    const throughDate = getKoreaTodayUtc()
    const [items, records, savedOutfits] = await Promise.all([
      prisma.wardrobeItem.findMany({
        where: { userId, ...activeWardrobeWhere },
        select: { id: true, name: true, category: true, colorName: true, colorHex: true },
      }),
      prisma.plannerEntry.findMany({
        where: { ...confirmedWearWhere, date: { lte: throughDate }, outfitId: { not: null }, plannerWeek: { is: { userId } } },
        select: { date: true, wornAt: true, outfit: { select: { id: true, style: true, items: { select: { wardrobeItemId: true } } } } },
      }),
      prisma.outfit.findMany({ where: { userId, ...savedOutfitWhere }, select: { id: true, name: true, items: { select: { wardrobeItemId: true } } } }),
    ])
    const summary = summarizeWardrobe(items, records, throughDate, savedOutfits)
    const [images, outfitImages] = await Promise.all([
      summary.mostWorn.length ? prisma.wardrobeItem.findMany({
        where: { userId, id: { in: summary.mostWorn.map((item) => item.id) } },
        select: { id: true, displayImageAsset: { select: imageAssetSelect } },
      }) : [],
      summary.mostWornOutfits.length ? prisma.outfit.findMany({
        where: { userId, ...savedOutfitWhere, id: { in: summary.mostWornOutfits.map((outfit) => outfit.id) } },
        select: {
          id: true,
          generations: {
            where: { status: 'completed', imageAssetId: { not: null } },
            orderBy: { requestedAt: 'desc' }, take: 1,
            select: { imageAsset: { select: imageAssetSelect } },
          },
          items: {
            orderBy: { layerOrder: 'asc' }, take: 4,
            select: { wardrobeItem: { select: { displayImageAsset: { select: imageAssetSelect } } } },
          },
        },
      }) : [],
    ])
    return {
      ...summary, totalOutfits: savedOutfits.length, throughDate: throughDate.toISOString().slice(0, 10),
      mostWorn: summary.mostWorn.map((item) => {
        const asset = images.find((image) => image.id === item.id)?.displayImageAsset
        return { ...item, imageUrl: imageUrl(asset) }
      }),
      mostWornOutfits: summary.mostWornOutfits.map((outfit) => {
        const images = outfitImages.find((image) => image.id === outfit.id)
        return {
          ...outfit,
          imageUrl: imageUrl(images?.generations[0]?.imageAsset),
          itemImageUrls: (images?.items ?? []).flatMap((item) => {
            const url = imageUrl(item.wardrobeItem.displayImageAsset)
            return url ? [url] : []
          }),
        }
      }),
    }
  },
}
