import { Shirt, Sparkles, X } from 'lucide-react'
import { AiCreditActionButton } from './AiCreditActionButton'
import { PreviewCreditSummary } from './PreviewCreditSummary'
import './OutfitRecommendationChoice.css'

interface OutfitRecommendationChoiceProps {
  categoryLabel: string
  hasClosetCandidates: boolean
  onClose: () => void
  /** 완료 결과나 진행 중인 요청은 사용권을 다시 확인하지 않고 연다. */
  hasExistingRequest: boolean
  onRecommend: () => void
}

/** 컬러·옷장 추천을 함께 받는 구성과 사용권 잔액을 실행 전에 보여준다. 0개일 때는 공통 충전 팝업을 연다. */
export function OutfitRecommendationChoice({
  categoryLabel,
  hasClosetCandidates,
  onClose,
  hasExistingRequest,
  onRecommend,
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
          <h2 id="outfit-style-choice-title">컬러와 옷을 함께 추천해요</h2>
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
          <div
            className="outfit-recommendation-choice__card outfit-recommendation-choice__card--items"
          >
            <span className="outfit-recommendation-choice__card-top">
              <span className="outfit-recommendation-choice__card-index">01 / MY CLOSET</span>
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
          </div>

          <div
            className="outfit-recommendation-choice__card outfit-recommendation-choice__card--colors"
          >
            <span className="outfit-recommendation-choice__card-top">
              <span className="outfit-recommendation-choice__card-index">02 / COLOR PALETTE</span>
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
          </div>
        </div>
      </div>
      <footer className="shrink-0 space-y-2 border-t border-line bg-surface px-4 pt-3 pb-[calc(.75rem+env(safe-area-inset-bottom))]">
        <p className="text-center text-[11px] leading-4 text-muted">
          {hasExistingRequest ? '받은 결과는 추가 사용 없이 다시 볼 수 있어요.' : 'AI 사용권 1개로 두 추천을 함께 받아요.'}
        </p>
        <PreviewCreditSummary kind="recommendation" />
        <AiCreditActionButton
          kind="recommendation"
          requiresCredit={!hasExistingRequest}
          label={hasExistingRequest ? '추천 결과 다시 보기' : '컬러·옷장 함께 추천받기'}
          adLabel="광고 보고 사용권 얻기"
          onClick={onRecommend}
          autoFocus
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-xs font-black text-white disabled:opacity-60"
        >
          <Sparkles size={16} aria-hidden="true" />
        </AiCreditActionButton>
      </footer>
    </section>
  )
}
