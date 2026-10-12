/** 코디 선택·AI 생성에 전달할 수 있는 아이템의 최대 개수. */
export const MAX_OUTFIT_ITEMS = 8

const bagPattern = /가방|백팩|배낭|토트백|숄더백|크로스백|에코백|캔버스\s*백|메신저백|보스턴백|클러치|(?:\b(?:bag|handbag|backpack|rucksack|tote|crossbody)\b)/iu
const genericSubcategories = new Set(['', '기타', '액세서리', '악세서리', 'accessory', 'other'])

/**
 * 액세서리·기타 중 가방을 구분한다. 구체적인 세부 분류를 우선하고,
 * 분류가 비어 있거나 포괄적인 구버전 아이템만 이름의 가방 표현으로 보완한다.
 * 벨트·장갑처럼 다른 세부 분류가 있는 아이템은 이름에 가방 표현이 있어도 제외한다.
 * @param {import('./outfitItems.js').WardrobeItemKindInput} item
 * @returns {boolean}
 */
export function isBagItem(item) {
  if (item.category !== 'accessory' && item.category !== 'other') return false
  const subcategory = (item.subcategory ?? '').normalize('NFKC').trim().toLocaleLowerCase()
  if (bagPattern.test(subcategory)) return true
  return genericSubcategories.has(subcategory) && bagPattern.test(item.name.normalize('NFKC'))
}
