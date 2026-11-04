import type { Prisma } from '@prisma/client'
import { ServiceError } from '../../graphql/errors.js'
import { lockGeneratedImageForReference } from '../image/image.repository.js'
import { outfitCompositionKey } from './outfit-composition.js'
import type { CreateOutfitData } from './outfit.repository.js'
import { lockWardrobeItemsForReference } from '../wardrobe/wardrobe-image-lifecycle.js'

export type SnapshotOutfit = Prisma.OutfitGetPayload<{ include: { items: true; generations: { include: { imageAsset: true } } } }>

/** 옷 구성·이름·스타일과 당시 완료 이미지 한 장을 별도 코디로 복사할 입력으로 만든다. 파일은 같은 자산을 참조한다. */
export function outfitSnapshotData(outfit: SnapshotOutfit): CreateOutfitData {
  const preview = [...outfit.generations]
    .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime())
    .find((generation) => generation.status === 'completed' && generation.imageAssetId && generation.imageAsset)
  return {
    userId: outfit.userId, name: outfit.name, style: outfit.style, seasons: [...outfit.seasons],
    source: outfit.source, note: outfit.note,
    items: outfit.items.map(({ wardrobeItemId, slot, layerOrder }) => ({ wardrobeItemId, slot, layerOrder })),
    ...(preview?.imageAssetId ? { generation: { userId: outfit.userId, imageAssetId: preview.imageAssetId, model: preview.model } } : {}),
  }
}

/** 이미지·이름만 달라진 저장은 실제로 입은 옷을 바꾸지 않으므로 날짜의 착용·체감·기온을 유지한다. */
export function sameWornItems(left: CreateOutfitData, right: CreateOutfitData) {
  const key = outfitCompositionKey(left.items.map((item) => item.wardrobeItemId))
  return Boolean(key) && key === outfitCompositionKey(right.items.map((item) => item.wardrobeItemId))
}

/** 같은 날짜의 동일 배정 요청에서는 기존 복사본을 재사용해 불필요한 교체를 피한다. */
export function sameOutfitSnapshot(left: CreateOutfitData, right: CreateOutfitData) {
  const fields = (data: CreateOutfitData) => ({
    name: data.name, style: data.style, source: data.source, note: data.note ?? null,
    seasons: [...data.seasons].sort(), image: data.generation?.imageAssetId ?? null,
    items: [...data.items].sort((a, b) => a.layerOrder - b.layerOrder || a.wardrobeItemId.localeCompare(b.wardrobeItemId)),
  })
  return JSON.stringify(fields(left)) === JSON.stringify(fields(right))
}

/** 기존 기록의 옷·사진 참조를 잠그고 별도 코디를 만든다. 새 직접 선택은 allowArchived=false로 삭제된 옷의 재연결을 거절한다. */
export async function createOutfitSnapshot(tx: Prisma.TransactionClient, data: CreateOutfitData, plannerOnly: boolean, options = { allowArchived: true }) {
  await lockWardrobeItemsForReference(tx, data.userId, data.items.map((item) => item.wardrobeItemId), options)
  if (data.generation) {
    if (data.generation.userId !== data.userId) throw new ServiceError('내 이미지로만 코디를 저장할 수 있습니다.', 'OUTFIT_PREVIEW_NOT_FOUND')
    await lockGeneratedImageForReference(tx, data.userId, data.generation.imageAssetId)
  }
  return tx.outfit.create({ data: {
    userId: data.userId, name: data.name, style: data.style, seasons: data.seasons,
    source: data.source, note: data.note, plannerOnly,
    items: { create: data.items },
    generations: data.generation ? { create: { ...data.generation, status: 'completed', completedAt: new Date() } } : undefined,
  } })
}

/** 기존에 원본을 직접 참조하던 날짜를 수정·삭제 전에 각각 복사한다. 착용·체감·기온·날짜 제목은 그대로 둔다. */
export async function preservePlannerSnapshots(tx: Prisma.TransactionClient, source: SnapshotOutfit) {
  const entries = await tx.plannerEntry.findMany({ where: { outfitId: source.id }, select: { id: true } })
  if (entries.length === 0) return
  const data = outfitSnapshotData(source)
  for (const entry of entries) {
    const copy = await createOutfitSnapshot(tx, data, true)
    const updated = await tx.plannerEntry.updateMany({ where: { id: entry.id, outfitId: source.id }, data: { outfitId: copy.id } })
    if (updated.count !== 1) throw new ServiceError('플래너가 변경됐습니다. 다시 확인해주세요.', 'PLANNER_ENTRY_CHANGED')
  }
}
