import { ArrowUpRight, Shirt, X } from 'lucide-react'
import './OutfitRecommendationChoice.css'

interface OutfitRecommendationChoiceProps {
  categoryLabel: string
  hasClosetCandidates: boolean
  onClose: () => void
  onChooseMode: (mode: 'items' | 'colors') => void
}

/** 현재 Look에 맞는 옷 또는 컬러를 고르는 두 경로를 시트의 같은 크기 영역에 표시한다. */
export function OutfitRecommendationChoice({
  categoryLabel,
  hasClosetCandidates,
  onClose,
  onChooseMode,
}: OutfitRecommendationChoiceProps) {
  return (
    <section
      className="outfit-recommendation-choice"
      role="dialog"
      aria-modal="false"
      aria-labelledby="outfit-style-choice-title"
      aria-describedby="outfit-style-choice-description"
    >
      <header className="outfit-recommendation-choice__header">
        <div className="outfit-recommendation-choice__heading">
          <span className="outfit-recommendation-choice__eyebrow">STYLE ASSIST</span>
          <h2 id="outfit-style-choice-title">어떤 도움을 받을까요?</h2>
          <p id="outfit-style-choice-description">
            지금 만드는 Look에 어울리는 {categoryLabel} 아이템과 색을 찾아보세요.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="outfit-recommendation-choice__close"
          aria-label="스타일 제안 선택 닫기"
        >
          <X size={19} aria-hidden="true" />
        </button>
      </header>

      <div className="outfit-recommendation-choice__body">
        <div className="outfit-recommendation-choice__cards">
          <button
            type="button"
            onClick={() => onChooseMode('items')}
            disabled={!hasClosetCandidates}
            autoFocus={hasClosetCandidates}
            className="outfit-recommendation-choice__card outfit-recommendation-choice__card--items"
          >
            <span className="outfit-recommendation-choice__card-top">
              <span className="outfit-recommendation-choice__card-index">01 / MY CLOSET</span>
              <ArrowUpRight size={19} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <span className="outfit-recommendation-choice__card-main">
              <span className="outfit-recommendation-choice__card-copy">
                <strong>내 옷장에서 찾기</strong>
                <span>
                  {hasClosetCandidates
                    ? '옷장에서 지금 Look에 맞는 아이템 찾기'
                    : `더 고를 ${categoryLabel} 아이템이 없어요`}
                </span>
              </span>
              <span className="outfit-recommendation-choice__wardrobe-art" aria-hidden="true">
                <span className="outfit-recommendation-choice__garment outfit-recommendation-choice__garment--back">
                  <Shirt size={34} strokeWidth={1.1} />
                </span>
                <span className="outfit-recommendation-choice__garment outfit-recommendation-choice__garment--front">
                  <Shirt size={38} strokeWidth={1.1} />
                </span>
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => onChooseMode('colors')}
            autoFocus={!hasClosetCandidates}
            className="outfit-recommendation-choice__card outfit-recommendation-choice__card--colors"
          >
            <span className="outfit-recommendation-choice__card-top">
              <span className="outfit-recommendation-choice__card-index">02 / COLOR PALETTE</span>
              <ArrowUpRight size={19} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <span className="outfit-recommendation-choice__card-main">
              <span className="outfit-recommendation-choice__card-copy">
                <strong>어울리는 컬러 찾기</strong>
                <span>지금 Look과 어울리는 색 조합 살펴보기</span>
              </span>
              <span className="outfit-recommendation-choice__palette-art" aria-hidden="true">
                <span className="outfit-recommendation-choice__swatch outfit-recommendation-choice__swatch--one" />
                <span className="outfit-recommendation-choice__swatch outfit-recommendation-choice__swatch--two" />
                <span className="outfit-recommendation-choice__swatch outfit-recommendation-choice__swatch--three" />
              </span>
            </span>
          </button>
        </div>
      </div>
    </section>
  )
}
