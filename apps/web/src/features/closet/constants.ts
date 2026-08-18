import type { ClothingCategory } from '@closet/types'

export const closetCategoryLabels: Record<ClothingCategory, string> = {
  top: '상의',
  bottom: '하의',
  outer: '아우터',
  midlayer: '중간 아우터',
  dress: '원피스',
  shoes: '신발',
  accessory: '액세서리',
  other: '기타',
}

export const closetSubcategoryOptions: Record<ClothingCategory, string[]> = {
  top: ['반팔', '긴팔', '셔츠', '니트', '맨투맨', '후드', '폴로 셔츠', '민소매'],
  bottom: [
    '슬랙스',
    '데님',
    '치노 팬츠',
    '와이드 팬츠',
    '일반 긴바지',
    '반바지',
    '스커트',
    '조거 팬츠',
    '레깅스',
  ],
  outer: ['블레이저', '재킷', '코트', '패딩'],
  midlayer: ['가디건', '베스트', '집업'],
  dress: ['원피스'],
  shoes: ['스니커즈', '로퍼', '구두', '부츠', '샌들', '힐', '슬리퍼'],
  accessory: ['모자', '가방', '벨트', '안경·선글라스', '목도리', '주얼리', '시계'],
  other: ['기타'],
}

export type ClosetFilter = ClothingCategory | 'all' | 'pending'

export const closetCategoryFilters: Array<{
  label: string
  value: ClosetFilter
}> = [
  { label: '전체', value: 'all' },
  { label: '상의', value: 'top' },
  { label: '하의', value: 'bottom' },
  { label: '아우터', value: 'outer' },
  { label: '중간 아우터', value: 'midlayer' },
  { label: '원피스', value: 'dress' },
  { label: '신발', value: 'shoes' },
  { label: '액세서리', value: 'accessory' },
  { label: '기타', value: 'other' },
  { label: '분류 대기', value: 'pending' },
]

export const MAX_CLOTHING_IMAGE_SIZE = 10 * 1024 * 1024

export const SUPPORTED_CLOTHING_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const
