import type { ClothingCategory } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { getImageDeliveryUrl } from '../image/image.service.js'
import { getKoreaTodayUtc, getWardrobeWearStats } from '../wardrobe/wardrobe.service.js'
import { activeWardrobeWhere, categoryLabels, savedOutfitWhere, styleLabels } from './catalog.service.js'

interface InventoryItem {
  id: string
  name: string
  category: ClothingCategory | null
  colorName: string | null
  colorHex: string | null
}
interface WearRecord {
  date: Date
  outfit: { id: string; style: string; items: Array<{ wardrobeItemId: string }> } | null
}
interface SavedOutfit { id: string; name: string }
interface Bucket { key: string; label: string; count: number; color: string | null }

export function summarizeWardrobe(items: InventoryItem[], records: WearRecord[], throughDate: Date, savedOutfits: SavedOutfit[] = []) {
  const pastRecords = records.filter((record) => record.date <= throughDate && record.outfit)
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
  const outfitWearCounts = new Map<string, number>()
  for (const record of pastRecords) {
    const outfit = record.outfit!
    const key = `${outfit.id}:${record.date.toISOString().slice(0, 10)}`
    if (wornOutfits.has(key)) continue
    wornOutfits.add(key)
    outfitWearCounts.set(outfit.id, (outfitWearCounts.get(outfit.id) ?? 0) + 1)
    add(styles, outfit.style, styleLabels[outfit.style] ?? outfit.style)
  }
  const ranked = (map: Map<string, Bucket>) => [...map.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ko'))
  return {
    totalItems: items.length,
    wearRecordCount: wornOutfits.size,
    unwornCount: items.filter((item) => !wear.has(item.id)).length,
    unwornOutfitCount: savedOutfits.filter((outfit) => !outfitWearCounts.has(outfit.id)).length,
    categories: ranked(categories), colors: ranked(colors), wornStyles: ranked(styles),
    mostWorn: items.map((item) => ({ id: item.id, name: item.name, wearCount: wear.get(item.id)?.wearCount ?? 0 }))
      .filter((item) => item.wearCount > 0)
      .sort((a, b) => b.wearCount - a.wearCount || a.name.localeCompare(b.name, 'ko') || a.id.localeCompare(b.id))
      .slice(0, 5),
    mostWornOutfits: savedOutfits.map((outfit) => ({ ...outfit, wearCount: outfitWearCounts.get(outfit.id) ?? 0 }))
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
        where: { date: { lte: throughDate }, outfitId: { not: null }, plannerWeek: { is: { userId } } },
        select: { date: true, outfit: { select: { id: true, style: true, items: { select: { wardrobeItemId: true } } } } },
      }),
      prisma.outfit.findMany({ where: { userId, ...savedOutfitWhere }, select: { id: true, name: true } }),
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
