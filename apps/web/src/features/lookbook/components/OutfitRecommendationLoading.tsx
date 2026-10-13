import { Palette, Search } from 'lucide-react'
import { ClothingCategoryIcon } from '../../../components/ClothingCategoryIcon'
import { outfitSelectionLabels, type OutfitSelectionCategory } from '../utils/outfitSelection'
import './OutfitRecommendationLoading.css'

interface OutfitRecommendationLoadingProps {
  /** 추천할 옷의 종류. 옷장 탐색 문구와 카드 아이콘에 사용한다. */
  category: OutfitSelectionCategory
  /** 선택한 결과 탭. 옷장 탐색과 컬러 탐색의 진행 표현을 구분한다. */
  mode: 'items' | 'colors'
}

/** 추천 응답을 기다리는 동안 선택한 탭에 맞는 탐색 장면과 진행 문구를 표시한다. */
export function OutfitRecommendationLoading({ category, mode }: OutfitRecommendationLoadingProps) {
  const isColorMode = mode === 'colors'

  return (
    <div className="outfit-recommendation-loading" role="status" aria-live="polite">
      <div className="outfit-recommendation-loading__art" aria-hidden="true">
        {isColorMode ? (
          <div className="outfit-recommendation-loading__palette">
            <span className="outfit-recommendation-loading__swatch outfit-recommendation-loading__swatch--one" />
            <span className="outfit-recommendation-loading__swatch outfit-recommendation-loading__swatch--two" />
            <span className="outfit-recommendation-loading__swatch outfit-recommendation-loading__swatch--three" />
            <span className="outfit-recommendation-loading__palette-marker">
              <Palette size={21} strokeWidth={1.7} />
            </span>
          </div>
        ) : (
          <div className="outfit-recommendation-loading__closet">
            <span className="outfit-recommendation-loading__garment outfit-recommendation-loading__garment--one">
              <ClothingCategoryIcon category={category} size={24} strokeWidth={1.4} />
            </span>
            <span className="outfit-recommendation-loading__garment outfit-recommendation-loading__garment--two">
              <ClothingCategoryIcon category={category} size={24} strokeWidth={1.4} />
            </span>
            <span className="outfit-recommendation-loading__garment outfit-recommendation-loading__garment--three">
              <ClothingCategoryIcon category={category} size={24} strokeWidth={1.4} />
            </span>
            <span className="outfit-recommendation-loading__search-marker">
              <Search size={20} strokeWidth={1.8} />
            </span>
          </div>
        )}
      </div>
      <strong className="outfit-recommendation-loading__title">
        {isColorMode
          ? '어울리는 컬러를 찾고 있어요'
          : `내 옷장에서 ${outfitSelectionLabels[category]} 찾는 중`}
      </strong>
      <span className="outfit-recommendation-loading__description">
        {isColorMode
          ? '지금 Look과 잘 맞는 색을 살펴보고 있어요.'
          : '함께 입기 좋은 아이템을 살펴보고 있어요.'}
      </span>
    </div>
  )
}
