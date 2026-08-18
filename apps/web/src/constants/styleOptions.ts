export type OutfitStyle =
  | 'minimal'
  | 'casual'
  | 'street'
  | 'classic'
  | 'vintage'
  | 'sporty'

export const outfitStyleOptions: Array<{
  label: string
  value: OutfitStyle
}> = [
  { label: '미니멀', value: 'minimal' },
  { label: '캐주얼', value: 'casual' },
  { label: '스트릿', value: 'street' },
  { label: '클래식', value: 'classic' },
  { label: '빈티지', value: 'vintage' },
  { label: '스포티', value: 'sporty' },
]

export const outfitStyleLabels: Record<OutfitStyle, string> = {
  minimal: '미니멀',
  casual: '캐주얼',
  street: '스트릿',
  classic: '클래식',
  vintage: '빈티지',
  sporty: '스포티',
}

export function getOutfitStyleLabel(style: string) {
  return outfitStyleLabels[style as OutfitStyle] ?? style
}
