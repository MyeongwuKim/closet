import type { TemperatureWearHistoryInput } from '@closet/types'
import { prisma } from '../../lib/prisma.js'
import { outfitPageWhere } from '../catalog/catalog.service.js'
import { outfitInclude } from '../outfit/outfit.repository.js'
import { confirmedWearWhere } from './planner-wear.js'

/**
 * 코디북 보관 여부와 관계없이 오늘까지 확인한 본인 착용을 읽는다.
 * 조합을 묶는 첫 조회에는 날짜·기온·체감·옷 ID만 포함하고 사진은 선택된 페이지에서만 읽는다.
 */
export const temperatureHistoryRepository = {
  findRecords(userId: string, throughDate: Date, input: TemperatureWearHistoryInput) {
    const outfitFilter = input.outfitFilter || input.compositionItemIds?.length
      ? outfitPageWhere(userId, {
        ...input.outfitFilter,
        wardrobeItemIds: [...(input.outfitFilter?.wardrobeItemIds ?? []), ...(input.compositionItemIds ?? [])],
      }, true)
      : { userId }
    return prisma.plannerEntry.findMany({
      where: {
        ...confirmedWearWhere,
        date: { lte: throughDate },
        plannerWeek: { is: { userId } },
        outfit: { is: outfitFilter },
      },
      select: {
        date: true, wornAt: true, wearTemperatureC: true, manualWearTemperatureC: true, wearFeeling: true,
        outfit: { select: { id: true, items: { select: { wardrobeItemId: true } } } },
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    })
  },

  /** 선택된 페이지의 본인 날짜 코디만 사진·삭제 옷 관계와 함께 읽는다. */
  findOutfits(userId: string, ids: string[]) {
    return prisma.outfit.findMany({ where: { userId, id: { in: ids } }, include: outfitInclude })
  },
}
