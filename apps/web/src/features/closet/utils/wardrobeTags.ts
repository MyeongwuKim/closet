import type { WardrobeItem } from '@closet/types'
import { closetCategoryLabels } from '../constants'
import { getWardrobeItemCategories } from './wardrobeCategories'

export const defaultWardrobeTags = [
  '자주 입는',
  '출근',
  '데이트',
  '여행',
  '운동',
  '비 오는 날',
]

export function normalizeWardrobeTag(value: string) {
  return value
    .normalize('NFKC')
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function tagKey(value: string) {
  return normalizeWardrobeTag(value).toLocaleLowerCase('ko-KR')
}

export function getRankedWardrobeTags(tags: string[], limit = 8) {
  const tagCounts = new Map<string, { label: string; count: number }>()

  tags.forEach((value) => {
    const label = normalizeWardrobeTag(value)
    const key = tagKey(label)
    if (!key) return

    const current = tagCounts.get(key)
    tagCounts.set(key, {
      label: current?.label ?? label,
      count: (current?.count ?? 0) + 1,
    })
  })

  return [...tagCounts.values()]
    .sort(
      (left, right) =>
        right.count - left.count || left.label.localeCompare(right.label, 'ko'),
    )
    .slice(0, limit)
    .map(({ label }) => label)
}

export function wardrobeItemHasTag(item: WardrobeItem, tag: string) {
  const targetKey = tagKey(tag)
  return item.tags.some((itemTag) => tagKey(itemTag) === targetKey)
}

export function wardrobeItemMatchesSearch(
  item: WardrobeItem,
  searchQuery: string,
) {
  const searchTerms = searchQuery
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .split(/\s+/)
    .filter(Boolean)

  if (searchTerms.length === 0) return true

  const categoryLabels = getWardrobeItemCategories(item).map(
    (category) => closetCategoryLabels[category],
  )
  const searchableText = [
    item.name,
    item.subcategory,
    item.colorName,
    item.colorDetailName,
    ...categoryLabels,
    ...item.tags,
  ]
    .filter(Boolean)
    .join(' ')
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')

  return searchTerms.every((term) => searchableText.includes(term))
}
