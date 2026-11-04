import type { OutfitMatchRelation } from '@closet/types'
import { getColorMatchEvidence } from './outfit-color-rules.js'
import {
  getColorHarmonyScore,
  getFashionAttributes,
  type StyleRuleItem,
} from './outfit-style-rules.js'

const MIN_ATTRIBUTE_CONFIDENCE = 0.6

type DesignCue = { score: number; reason: string }

function isUpper(item: StyleRuleItem) {
  return item.category === 'top' || item.category === 'midlayer' || item.category === 'outer'
}

function isUpperBottomPair(left: StyleRuleItem, right: StyleRuleItem) {
  return (isUpper(left) && right.category === 'bottom') ||
    (isUpper(right) && left.category === 'bottom')
}

function isLoose(silhouette: string) {
  return silhouette === 'relaxed' || silhouette === 'oversized'
}

/** 관찰 확신도가 충분한 속성만 비교해 디자인 가점과 설명 가능한 근거를 반환한다. */
function getDesignCompatibility(selected: StyleRuleItem, candidate: StyleRuleItem) {
  const selectedAttributes = getFashionAttributes(selected)
  const candidateAttributes = getFashionAttributes(candidate)
  const confidence = Math.min(selectedAttributes.confidence, candidateAttributes.confidence)
  if (confidence < MIN_ATTRIBUTE_CONFIDENCE) return { score: 0, cues: [] as DesignCue[] }

  let score = 0
  const cues: DesignCue[] = []
  const selectedHasPattern = !['solid', 'unknown'].includes(selectedAttributes.pattern)
  const candidateHasPattern = !['solid', 'unknown'].includes(candidateAttributes.pattern)

  if (selectedHasPattern && candidateAttributes.pattern === 'solid') {
    score += 1.1 * confidence
    cues.push({ score: 1.1 * confidence, reason: '고른 옷의 무늬를 단색으로 받쳐줘요.' })
  } else if (selectedHasPattern && candidateHasPattern) {
    score -= 1.2 * confidence
  }

  if (isUpperBottomPair(selected, candidate)) {
    const leftShape = selectedAttributes.silhouette
    const rightShape = candidateAttributes.silhouette
    if (leftShape !== 'unknown' && rightShape !== 'unknown') {
      if (
        (isLoose(leftShape) && rightShape === 'slim') ||
        (isLoose(rightShape) && leftShape === 'slim')
      ) {
        score += 1.25 * confidence
        cues.push({ score: 1.25 * confidence, reason: '여유로운 옷과 슬림한 옷의 실루엣이 균형을 이뤄요.' })
      } else if (leftShape === 'regular' || rightShape === 'regular') {
        score += 0.4 * confidence
        cues.push({ score: 0.4 * confidence, reason: '기본 핏이 다른 옷의 실루엣과 자연스럽게 이어져요.' })
      }
    }
  }

  const formalityGap = Math.abs(selectedAttributes.formality - candidateAttributes.formality)
  if (formalityGap <= 0.2) {
    score += 0.7 * confidence
    cues.push({ score: 0.7 * confidence, reason: '고른 옷과 격식감이 비슷해 자연스럽게 이어져요.' })
  } else if (formalityGap >= 0.5) {
    score -= 0.85 * confidence
  }

  return { score, cues }
}

/**
 * 선택한 옷과 후보의 대표색 및 신뢰할 수 있는 디자인 속성을 비교해 추천 순서를 정한다.
 * 선택한 ID는 제외하고 최대 limit개(기본 5개)를 반환하며 동점이면 원래 후보 순서를 유지한다.
 * 속성이 없거나 확신도가 낮으면 색 비교만 사용한다. 이전 호출의 추천 색상명 순서는 점수·관계에 사용하지 않는다.
 */
export function rankOutfitMatchCandidates<
  Selected extends StyleRuleItem,
  Candidate extends StyleRuleItem,
>(
  selectedItems: Selected[],
  candidates: Candidate[],
  _recommendedColorNames: string[],
  limit = 5,
): Array<{ item: Candidate; relation: OutfitMatchRelation; reason: string }> {
  const selectedIds = new Set(selectedItems.map((item) => item.id))
  const ranked = candidates
    .filter((item) => !selectedIds.has(item.id))
    .map((item, index) => {
      const colorEvidence = getColorMatchEvidence(selectedItems, item)
      const colorHarmony = selectedItems.length > 0
        ? selectedItems.reduce(
          (sum, selected) => sum + getColorHarmonyScore(selected, item),
          0,
        ) / selectedItems.length
        : 0
      const comparisons = selectedItems.map((selected) => getDesignCompatibility(selected, item))
      const designScore = comparisons.length > 0
        ? comparisons.reduce((sum, comparison) => sum + comparison.score, 0) / comparisons.length
        : 0
      const strongestCue = comparisons
        .flatMap((comparison) => comparison.cues)
        .sort((left, right) => right.score - left.score)[0]
      const hasDesignReason = designScore >= 0.35 && strongestCue !== undefined

      return {
        item,
        index,
        score: colorHarmony + designScore,
        relation: hasDesignReason
          ? 'design-balance' as const
          : colorEvidence.relation,
        reason: hasDesignReason ? strongestCue.reason : colorEvidence.reason,
      }
    })

  return ranked
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, Math.max(0, Math.floor(limit)))
    .map(({ item, relation, reason }) => ({ item, relation, reason }))
}
