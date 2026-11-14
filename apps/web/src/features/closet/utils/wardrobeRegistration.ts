import type { SaveWardrobeItemInput } from '../api/saveWardrobeItem'
import type { ClassificationCandidate } from '../../../stores/useUiStore'
import { fashionAttributesFromItem, mergeEditableFashionAttributes } from './fashionAttributes'

/** 저장 전 확인 값. 미분류 사진은 종류를 미선택 상태로 두어 사용자가 수정한다. */
export type WardrobeRegistrationDraft = Omit<SaveWardrobeItemInput, 'category'> & { category: SaveWardrobeItemInput['category'] | null }

/** 분석 결과로 최초 입력값을 만든다. 뒤늦게 도착한 다른 사진이 기존 편집을 덮어쓰지 않게 항목별로 사용한다. */
export function createWardrobeRegistrationDraft(candidate: ClassificationCandidate): WardrobeRegistrationDraft {
  return {
    name: candidate.itemName, brandName: null, storageLocation: null,
    category: candidate.category, additionalCategories: [], subcategory: candidate.subcategory,
    colorName: candidate.colorName, colorDetailName: candidate.colorDetailName || null, colorHex: candidate.colorHex, colorMode: candidate.colorMode,
    fashionAttributes: mergeEditableFashionAttributes(candidate.fashionAttributes, fashionAttributesFromItem(candidate.fashionAttributes), candidate.category ?? 'other'),
    seasons: [], tags: [],
  }
}

/** 이름·분류·색상·계절의 부족한 값을 안내한다. 상세 속성·치수·보관 위치는 선택 사항이다. */
export function validateWardrobeRegistrationDraft(draft: WardrobeRegistrationDraft) {
  if (!draft.name.trim()) return '아이템 이름을 입력해주세요.'
  if (!draft.category || !draft.subcategory.trim()) return '정보 수정에서 옷 종류를 골라주세요.'
  if (!draft.colorName.trim()) return '정보 수정에서 색상을 확인해주세요.'
  if (!draft.seasons.length) return '입을 계절을 골라주세요.'
  return null
}

/** 확인이 끝난 값만 기존 한 벌 저장 API의 입력으로 변환한다. */
export function toWardrobeRegistrationInput(draft: WardrobeRegistrationDraft): SaveWardrobeItemInput {
  const error = validateWardrobeRegistrationDraft(draft)
  if (error || !draft.category) throw new Error(error ?? '옷 종류를 골라주세요.')
  return { ...draft, category: draft.category, name: draft.name.trim() }
}
