import type { ClothingCategory } from '@closet/types'

export interface FashionTypeLabel {
  prompt: string
  category: ClothingCategory
  subcategory: string
  label: string
}

export interface FashionColorLabel {
  prompt: string
  name: string
  hex: string
}

export const categoryLabels: Record<ClothingCategory, string> = {
  top: '상의',
  bottom: '하의',
  outer: '아우터',
  midlayer: '중간 아우터',
  dress: '원피스',
  shoes: '신발',
  accessory: '액세서리',
  other: '기타',
}

export const fashionTypeLabels: FashionTypeLabel[] = [
  { prompt: 'a short-sleeve t-shirt', category: 'top', subcategory: 'short-sleeve', label: '반팔' },
  { prompt: 'a long-sleeve t-shirt', category: 'top', subcategory: 'long-sleeve', label: '긴팔' },
  { prompt: 'a dress shirt or blouse', category: 'top', subcategory: 'shirt', label: '셔츠' },
  { prompt: 'a knit sweater', category: 'top', subcategory: 'knit', label: '니트' },
  { prompt: 'a sweatshirt', category: 'top', subcategory: 'sweatshirt', label: '맨투맨' },
  { prompt: 'a hoodie', category: 'top', subcategory: 'hoodie', label: '후드' },
  { prompt: 'a polo shirt', category: 'top', subcategory: 'polo', label: '폴로 셔츠' },
  { prompt: 'a tank top', category: 'top', subcategory: 'tank-top', label: '민소매' },
  { prompt: 'slacks or dress pants', category: 'bottom', subcategory: 'slacks', label: '슬랙스' },
  { prompt: 'denim jeans', category: 'bottom', subcategory: 'jeans', label: '데님' },
  { prompt: 'structured cotton twill chino pants with a fitted waistband and front fastening', category: 'bottom', subcategory: 'chinos', label: '치노 팬츠' },
  { prompt: 'full-length wide-leg pants, including wide sweatpants, with loose legs reaching the ankles', category: 'bottom', subcategory: 'wide-pants', label: '와이드 팬츠' },
  { prompt: 'full-length straight-leg casual pants with legs reaching the ankles', category: 'bottom', subcategory: 'pants', label: '일반 긴바지' },
  { prompt: 'shorts with short legs ending above the knees', category: 'bottom', subcategory: 'shorts', label: '반바지' },
  { prompt: 'a skirt', category: 'bottom', subcategory: 'skirt', label: '스커트' },
  { prompt: 'full-length jogger pants with tapered legs or elastic ankle cuffs', category: 'bottom', subcategory: 'joggers', label: '조거 팬츠' },
  { prompt: 'leggings', category: 'bottom', subcategory: 'leggings', label: '레깅스' },
  { prompt: 'a blazer', category: 'outer', subcategory: 'blazer', label: '블레이저' },
  { prompt: 'a casual jacket', category: 'outer', subcategory: 'jacket', label: '재킷' },
  { prompt: 'a long coat', category: 'outer', subcategory: 'coat', label: '코트' },
  { prompt: 'a padded puffer jacket', category: 'outer', subcategory: 'puffer', label: '패딩' },
  { prompt: 'a cardigan worn as a middle layer', category: 'midlayer', subcategory: 'cardigan', label: '가디건' },
  { prompt: 'a fashion vest worn as a middle layer', category: 'midlayer', subcategory: 'vest', label: '베스트' },
  { prompt: 'a zip-up hoodie or track jacket worn as a middle layer', category: 'midlayer', subcategory: 'zip-up', label: '집업' },
  { prompt: 'a one-piece dress', category: 'dress', subcategory: 'dress', label: '원피스' },
  { prompt: 'sneakers', category: 'shoes', subcategory: 'sneakers', label: '스니커즈' },
  { prompt: 'loafers', category: 'shoes', subcategory: 'loafers', label: '로퍼' },
  { prompt: 'formal leather shoes', category: 'shoes', subcategory: 'dress-shoes', label: '구두' },
  { prompt: 'boots', category: 'shoes', subcategory: 'boots', label: '부츠' },
  { prompt: 'sandals', category: 'shoes', subcategory: 'sandals', label: '샌들' },
  { prompt: 'high heels', category: 'shoes', subcategory: 'heels', label: '힐' },
  { prompt: 'slippers', category: 'shoes', subcategory: 'slippers', label: '슬리퍼' },
  { prompt: 'a standalone waist belt fashion product', category: 'accessory', subcategory: 'belt', label: '벨트' },
  { prompt: 'a standalone hat, cap, beanie, or bucket hat fashion product', category: 'accessory', subcategory: 'hat', label: '모자' },
  { prompt: 'a standalone scarf or muffler fashion product', category: 'accessory', subcategory: 'scarf', label: '목도리' },
  { prompt: 'another fashion item or bag', category: 'other', subcategory: 'other', label: '기타' },
]

export const fashionColorLabels: FashionColorLabel[] = [
  { prompt: 'black clothing', name: '블랙', hex: '#242424' },
  { prompt: 'white clothing', name: '화이트', hex: '#f2f1ec' },
  { prompt: 'cream or ivory clothing', name: '크림', hex: '#e7ddc9' },
  { prompt: 'beige clothing', name: '베이지', hex: '#c9b28f' },
  { prompt: 'gray clothing', name: '그레이', hex: '#777872' },
  { prompt: 'navy clothing', name: '네이비', hex: '#27394a' },
  { prompt: 'blue clothing', name: '블루', hex: '#4f78a1' },
  { prompt: 'brown clothing', name: '브라운', hex: '#775444' },
  { prompt: 'red clothing', name: '레드', hex: '#b9463f' },
  { prompt: 'pink clothing', name: '핑크', hex: '#d79aa4' },
  { prompt: 'orange clothing', name: '오렌지', hex: '#d7773c' },
  { prompt: 'yellow clothing', name: '옐로', hex: '#d6b546' },
  { prompt: 'green clothing', name: '그린', hex: '#55775c' },
  { prompt: 'olive clothing', name: '올리브', hex: '#727158' },
  { prompt: 'purple clothing', name: '퍼플', hex: '#745c82' },
  { prompt: 'multicolored patterned clothing', name: '다색', hex: '#8f7f70' },
]

export function getFashionClipModelId() {
  return process.env.FASHION_CLIP_MODEL ?? 'Marqo/marqo-fashionCLIP'
}
