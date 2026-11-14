import type { ClothingCategory, Prisma, Season } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { makePage, readPageInput, type PageInput } from '../../lib/pagination.js'
import { ServiceError } from '../../graphql/errors.js'
import { wardrobeItemInclude, wardrobeRepository } from '../wardrobe/wardrobe.repository.js'
import { getWardrobeWearStats, getKoreaTodayUtc } from '../wardrobe/wardrobe.service.js'
import { outfitInclude } from '../outfit/outfit.repository.js'

export const categoryLabels: Record<ClothingCategory, string> = {
  top: '상의', bottom: '하의', outer: '아우터', midlayer: '중간 아우터',
  dress: '원피스', shoes: '신발', accessory: '액세서리', other: '기타',
}
export const styleLabels: Record<string, string> = {
  minimal: '미니멀', casual: '캐주얼', street: '스트릿', classic: '클래식', vintage: '빈티지', sporty: '스포티',
}
const seasonLabels: Record<Season, string> = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' }
export const activeWardrobeWhere = {
  OR: [{ archivedAt: null }, { archivedAt: { isSet: false } }],
} satisfies Prisma.WardrobeItemWhereInput
export const savedOutfitWhere = {
  OR: [{ plannerOnly: false }, { plannerOnly: null }, { plannerOnly: { isSet: false } }],
} satisfies Prisma.OutfitWhereInput

export interface WardrobePageInput extends PageInput {
  category?: ClothingCategory | null
  subcategory?: string | null
  /** 기존 단일 브랜드 입력. 복수 brandNames와 함께 전달하면 합친다. */
  brandName?: string | null
  /** true이면 브랜드가 없는 옷만 조회하며 brandName보다 우선한다. */
  unbrandedOnly?: boolean | null
  /** 같은 항목의 여러 선택은 OR로 묶는다. 기존 단일 브랜드명과 함께 전달하면 합친다. */
  brandNames?: string[] | null
  /** 선택한 브랜드들과 브랜드 미지정 옷을 함께 조회한다. unbrandedOnly의 단독 조회 동작은 유지한다. */
  includeUnbranded?: boolean | null
  season?: Season | null
  color?: string | null
  colors?: string[] | null
  tag?: string | null
  tags?: string[] | null
  search?: string | null
}
export interface OutfitPageInput extends PageInput {
  style?: string | null
  season?: Season | null
  color?: string | null
  wardrobeItemIds?: string[] | null
  search?: string | null
}
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ko-KR').trim()
const tokens = (value?: string | null) => normalize(value ?? '').split(/\s+/).filter(Boolean)
const contains = (value: string) => ({ contains: value, mode: 'insensitive' as const })
const matchingCategories = (term: string) => (Object.keys(categoryLabels) as ClothingCategory[])
  .filter((key) => categoryLabels[key].includes(term) || key.includes(term))

function categoryWhere(category: ClothingCategory): Prisma.WardrobeItemWhereInput {
  return { OR: [{ category }, { additionalCategories: { has: category } }] }
}

/** 단일·복수 입력을 합치고 공백·중복을 제거한다. 브랜드는 유니코드·연속 공백도 정리한다. */
function filterValues(single: string | null | undefined, multiple: string[] | null | undefined, isBrand = false) {
  const values = new Map<string, string>()
  for (const raw of [...(single ? [single] : []), ...(multiple ?? [])]) {
    const value = isBrand ? raw.normalize('NFKC').replace(/\s+/g, ' ').trim() : raw.trim()
    const key = isBrand ? normalize(value) : value
    if (value && !values.has(key)) values.set(key, value)
  }
  return [...values.values()]
}

/** 보관 중인 내 옷에 항목 간 AND·같은 항목의 OR를 적용한다. 기존 단일 필터와 미지정 단독 조건을 유지하며 조회·개수 집계가 같은 조건을 사용한다. */
export function wardrobePageWhere(userId: string, input: WardrobePageInput, tags: string[] = []): Prisma.WardrobeItemWhereInput {
  const brands = filterValues(input.brandName, input.brandNames, true)
  const colors = filterValues(input.color, input.colors)
  const selectedTags = new Set(filterValues(input.tag, input.tags).map(normalize))
  const missingBrand: Prisma.WardrobeItemWhereInput[] = [
    { brandName: null }, { brandName: { isSet: false } }, { brandName: '' },
  ]
  const brandOptions: Prisma.WardrobeItemWhereInput[] = brands.map((brandName) => ({ brandName: { equals: brandName, mode: 'insensitive' } }))
  if (input.includeUnbranded) brandOptions.push(...missingBrand)
  const brandWhere = input.unbrandedOnly ? { OR: missingBrand }
    : brandOptions.length === 1 ? brandOptions[0]
      : brandOptions.length > 1 ? { OR: brandOptions } : null
  return {
    userId,
    AND: [
      activeWardrobeWhere,
      ...(input.category ? [categoryWhere(input.category)] : []),
      ...(input.subcategory ? [{ subcategory: input.subcategory }] : []),
      ...(brandWhere ? [brandWhere] : []),
      ...(input.season ? [{ seasons: { has: input.season } }] : []),
      ...(colors.length ? [{ colorName: colors.length === 1 ? colors[0] : { in: colors } }] : []),
      ...(selectedTags.size ? [{ tags: { hasSome: tags.filter((tag) => selectedTags.has(normalize(tag))) } }] : []),
      ...tokens(input.search).map((term) => ({ OR: [
        { name: contains(term) }, { subcategory: contains(term) },
        { brandName: contains(term) },
        { storageLocation: contains(term) },
        { colorName: contains(term) }, { colorDetailName: contains(term) },
        { category: { in: matchingCategories(term) } },
        { additionalCategories: { hasSome: matchingCategories(term) } },
        { tags: { hasSome: tags.filter((tag) => normalize(tag).includes(term)) } },
      ] })),
    ],
  }
}

export function outfitPageWhere(userId: string, input: OutfitPageInput): Prisma.OutfitWhereInput {
  const itemIds = [...new Set(input.wardrobeItemIds ?? [])]
  if (itemIds.some((id) => !/^[a-f\d]{24}$/i.test(id))) {
    throw new ServiceError('옷 아이템 ID가 올바르지 않아요.', 'INVALID_OUTFIT_FILTER')
  }
  return {
    userId,
    AND: [
      savedOutfitWhere,
      ...(input.style && input.style !== 'all' ? [{ style: input.style }] : []),
      ...(input.season ? [{ seasons: { has: input.season } }] : []),
      ...(input.color ? [{ items: { some: { wardrobeItem: { is: { colorName: input.color } } } } }] : []),
      ...itemIds.map((wardrobeItemId) => ({ items: { some: { wardrobeItemId } } })),
      ...tokens(input.search).map((term) => ({ OR: [
        { name: contains(term) }, { style: contains(term) },
        { style: { in: Object.keys(styleLabels).filter((key) => styleLabels[key].includes(term)) } },
        { seasons: { hasSome: (Object.keys(seasonLabels) as Season[]).filter((key) => seasonLabels[key].includes(term)) } },
        { items: { some: { wardrobeItem: { is: { OR: [
          { name: contains(term) }, { subcategory: contains(term) }, { colorName: contains(term) },
          { category: { in: matchingCategories(term) } },
        ] } } } } },
      ] })),
    ],
  }
}

function colorOptions(items: Array<{ colorName: string | null; colorHex: string | null }>) {
  return [...new Map(items.filter((item) => item.colorName?.trim()).map((item) => [
    item.colorName!.trim(), { name: item.colorName!.trim(), hex: item.colorHex ?? '#d9d5cc' },
  ])).values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}

export const catalogService = {
  async wardrobePage(userId: string, input: WardrobePageInput = {}) {
    const page = readPageInput(input)
    const tags = input.search || input.tag || input.tags?.length ? (await prisma.wardrobeItem.findMany({
      where: { userId, ...activeWardrobeWhere }, select: { tags: true },
    })).flatMap((item) => item.tags) : []
    const where = wardrobePageWhere(userId, input, tags)
    const [rows, totalCount] = await Promise.all([
      prisma.wardrobeItem.findMany({
        where: { AND: [where, page.after] }, include: wardrobeItemInclude,
        orderBy: [{ createdAt: page.order }, { id: page.order }], take: page.limit + 1,
      }),
      prisma.wardrobeItem.count({ where }),
    ])
    const result = makePage(rows, totalCount, page)
    const history = result.items.length ? await wardrobeRepository.findWearHistory(
      userId, getKoreaTodayUtc(), result.items.map((item) => item.id),
    ) : []
    const wear = getWardrobeWearStats(history)
    return { ...result, items: result.items.map((item) => ({
      ...item, wearCount: wear.get(item.id)?.wearCount ?? 0, lastWornAt: wear.get(item.id)?.lastWornAt ?? null,
    })) }
  },

  async outfitPage(userId: string, input: OutfitPageInput = {}) {
    const page = readPageInput(input)
    const where = outfitPageWhere(userId, input)
    const [rows, totalCount] = await Promise.all([
      prisma.outfit.findMany({
        where: { AND: [where, page.after] }, include: outfitInclude,
        orderBy: [{ createdAt: page.order }, { id: page.order }], take: page.limit + 1,
      }),
      prisma.outfit.count({ where }),
    ])
    return makePage(rows, totalCount, page)
  },

  async wardrobeFilters(userId: string, category?: ClothingCategory | null, subcategory?: string | null) {
    const items = await prisma.wardrobeItem.findMany({
      where: { userId, ...activeWardrobeWhere },
      select: { category: true, additionalCategories: true, subcategory: true, colorName: true, colorHex: true, tags: true },
    })
    const inCategory = items.filter((item) => !category || item.category === category || item.additionalCategories.includes(category))
    const tagCounts = new Map<string, { label: string; count: number }>()
    for (const tag of items.flatMap((item) => item.tags)) {
      const key = normalize(tag)
      const previous = tagCounts.get(key)
      if (key) tagCounts.set(key, { label: previous?.label ?? tag, count: (previous?.count ?? 0) + 1 })
    }
    return {
      totalCount: items.length,
      categories: [...new Set(items.flatMap((item) => [item.category, ...item.additionalCategories]).filter(Boolean))],
      subcategories: [...new Set(inCategory.map((item) => item.subcategory?.trim()).filter(Boolean))],
      colors: colorOptions(inCategory.filter((item) => !subcategory || item.subcategory === subcategory)),
      tags: [...tagCounts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ko')).slice(0, 8).map((tag) => tag.label),
    }
  },

  async outfitFilters(userId: string) {
    const outfits = await prisma.outfit.findMany({
      where: { userId, ...savedOutfitWhere },
      select: { style: true, items: { select: { wardrobeItem: { select: { colorName: true, colorHex: true } } } } },
    })
    return {
      totalCount: outfits.length,
      styles: [...new Set(outfits.map((outfit) => outfit.style))],
      colors: colorOptions(outfits.flatMap((outfit) => outfit.items.map((item) => item.wardrobeItem))),
    }
  },
}
