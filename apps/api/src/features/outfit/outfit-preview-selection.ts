import { MAX_OUTFIT_ITEMS } from '@closet/types/outfit-items'
import { ServiceError } from '../../graphql/errors.js'
import { wardrobeRepository } from '../wardrobe/wardrobe.repository.js'
import { hasCompleteOutfitBase } from './outfit-composition.js'

/** 2~8개의 활성 보유 옷과 이미지·기본 구성을 검증하고, 중복을 제외한 요청 순서로 옷을 반환한다. */
export async function getOutfitPreviewItems(userId: string, selectedItemIds: string[]) {
  const uniqueItemIds = [...new Set(selectedItemIds)]
  if (uniqueItemIds.length < 2 || uniqueItemIds.length > MAX_OUTFIT_ITEMS) {
    throw new ServiceError('AI 룩 미리보기는 2개에서 8개의 옷으로 만들 수 있습니다.', 'INVALID_OUTFIT_PREVIEW_ITEMS')
  }
  const items = await wardrobeRepository.findManyOwnedWithImagesByIds(userId, uniqueItemIds)
  if (items.length !== uniqueItemIds.length || items.some((item) => !item.category || !item.displayImageAsset?.deliveryUrl)) {
    throw new ServiceError('이미지가 있는 내 옷장 아이템만 미리보기에 사용할 수 있습니다.', 'INVALID_OUTFIT_PREVIEW_ITEMS')
  }
  const byId = new Map(items.map((item) => [item.id, item]))
  const ordered = uniqueItemIds.map((id) => byId.get(id)!)
  if (!hasCompleteOutfitBase(ordered.map((item) => item.category!))) {
    throw new ServiceError('AI 룩을 만들려면 상의나 아우터와 하의를 함께 선택해주세요.', 'INCOMPLETE_OUTFIT_PREVIEW_ITEMS')
  }
  return ordered
}
