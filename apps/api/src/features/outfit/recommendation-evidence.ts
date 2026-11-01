import { getFashionAttributes, type StyleRuleItem } from './outfit-style-rules.js'

/** 저장된 분석의 확신도가 0.6 이상일 때만 설명용 관찰 속성을 제공한다. 규칙 엔진의 보조 추정값은 AI에 넘기지 않는다. */
export function getObservedRecommendationAttributes(item: StyleRuleItem) {
  if (!item.fashionAttributes || typeof item.fashionAttributes !== 'object') return null
  const attributes = getFashionAttributes(item)
  return attributes.confidence >= 0.6 ? attributes : null
}

/** 핏 관찰값이나 명시적인 옷 이름이 전혀 없으면 핏·체형 효과를 단정하는 AI 설명을 거절한다. */
export function hasGroundedFitDescription(text: string, items: StyleRuleItem[]) {
  const hasFitEvidence = items.some((item) => {
    const attributes = getObservedRecommendationAttributes(item)
    return (attributes && attributes.silhouette !== 'unknown') || /와이드|스키니|오버핏|오버사이즈|슬림핏|레귤러핏/u.test(`${item.name} ${item.subcategory ?? ''}`)
  })
  // 정보가 없다는 안내 자체는 허용하되, 구체적인 핏·체형 효과를 단정한 문장은 걸러낸다.
  return hasFitEvidence || !/기본\s*핏|레귤러|오버사이즈|스키니|슬림(?:한|핏)?|여유로운\s*(?:핏|실루엣)|착용감|몸에\s*맞|(?:어깨|가슴선|골반).{0,16}(?:맞|감싸|정리|잡아)|실루엣.{0,20}(?:균형|정리|맞춰|만들)|핏(?:이|을|은|과)?\s*(?:좋|편|단정|맞|균형|보완)/u.test(text)
}
