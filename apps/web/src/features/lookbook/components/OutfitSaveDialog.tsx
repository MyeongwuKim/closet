import { BookHeart, Sparkles, X } from 'lucide-react'
import { SeasonMultiSelect } from '../../../components/SeasonMultiSelect'
import { useOutfitComposer } from '../contexts/OutfitComposerContext'
import { ComposerLookCanvas } from './ComposerLookCanvas'
import { OutfitStyleSelector } from './OutfitStyleSelector'
import { OutfitSavingState } from './OutfitSavingState'

/**
 * 코디 맞춰보기에서 고른 옷을 한 장의 Look으로 확인한 뒤 이름·스타일·계절을 정한다.
 * 이름·스타일·계절이 빠지면 제출을 막고, 실제 저장은 composer 세션에 맡긴다.
 * 저장 중에는 입력 대신 수납 장면을 표시한다.
 */
export function OutfitSaveDialog() {
  const {
    selectedItems,
    isSaveOpen,
    outfitName,
    outfitStyle,
    outfitSeasons,
    styleOptions,
    includesPreview,
    isSaving,
    isPersisting,
    setOutfitName,
    setOutfitStyle,
    setOutfitSeasons,
    saveOutfit,
    closeSave,
  } = useOutfitComposer()
  if (!isSaveOpen) return null

  return (
    <div
      className="classification-page-enter fixed inset-0 z-[120] flex items-center justify-center bg-black/45 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="outfit-save-title"
      aria-busy={isSaving}
      onMouseDown={(event) => {
        if (!isSaving && event.target === event.currentTarget) closeSave()
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!isSaving) saveOutfit()
        }}
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-surface shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:max-w-5xl sm:rounded-[1.75rem]"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-line bg-surface px-5 py-4 sm:px-8">
          <span className="flex size-10 items-center justify-center rounded-2xl border border-line bg-canvas text-ink">
            <BookHeart size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold tracking-[0.2em] text-muted">
              LOOK REVIEW
            </span>
            <h2 id="outfit-save-title" className="mt-0.5 text-lg font-black leading-tight">
              이 Look으로 저장할까요?
            </h2>
            <p className="mt-1 text-[11px] text-muted">
              조합을 확인하고 코디북에 담아보세요.
            </p>
          </div>
          <button
            type="button"
            onClick={closeSave}
            disabled={isSaving}
            autoFocus
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink disabled:opacity-40"
            aria-label="코디 저장 닫기"
          >
            <X size={18} />
          </button>
        </header>

        <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-7">
          {isSaving ? (
            <OutfitSavingState isPersisting={isPersisting} />
          ) : (
            <div className="grid gap-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-8">
              <section aria-label="완성한 Look 미리보기" className="min-w-0">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold tracking-[0.2em] text-muted">YOUR EDIT</span>
                    <p className="mt-1 text-sm font-bold text-ink">내 옷장에서 완성한 조합</p>
                  </div>
                  <span className="text-[11px] text-muted">{selectedItems.length}개의 아이템</span>
                </div>
                <ComposerLookCanvas
                  selectedItems={selectedItems}
                  lookName={outfitName}
                />
              </section>

              <section aria-label="Look 정보" className="min-w-0 border-t border-line pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
                <span className="text-[10px] font-bold tracking-[0.2em] text-muted">THE DETAILS</span>
                <h3 className="mt-1 text-xl font-black text-ink">코디북에 남길 이름</h3>
                <p className="mt-1 text-xs leading-5 text-muted">
                  이 Look을 다시 찾기 쉽도록 이름과 스타일을 정해주세요.
                </p>

                <label className="mt-6 grid gap-2 text-xs font-black">
                  코디 이름
                  <input
                    type="text"
                    value={outfitName}
                    onChange={(event) => setOutfitName(event.target.value)}
                    placeholder="예: 주말의 편안한 코디"
                    maxLength={40}
                    className="h-12 rounded-xl border border-line bg-canvas px-3 text-sm font-bold outline-none transition focus:border-accent"
                    required
                  />
                </label>

                <fieldset className="mt-6">
                  <legend className="text-xs font-black">코디 스타일</legend>
                  <div className="mt-2">
                    <OutfitStyleSelector
                      value={outfitStyle}
                      options={styleOptions}
                      onChange={setOutfitStyle}
                    />
                  </div>
                </fieldset>

                <fieldset className="mt-6">
                  <legend className="text-xs font-black">입을 계절</legend>
                  <p className="mt-1 text-[11px] text-muted">
                    선택한 옷의 공통 계절을 먼저 표시해요.
                  </p>
                  <div className="mt-2">
                    <SeasonMultiSelect
                      value={outfitSeasons}
                      onChange={setOutfitSeasons}
                    />
                  </div>
                </fieldset>

                {includesPreview && (
                  <div className="mt-5 flex items-center gap-2 rounded-xl bg-sage px-3 py-2.5 text-[11px] font-bold text-ink">
                    <Sparkles size={14} className="shrink-0 text-accent" />
                    AI 룩 이미지도 함께 저장돼요.
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        <footer className="grid shrink-0 grid-cols-[0.75fr_1.25fr] gap-2 border-t border-line bg-surface px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-8">
          <button
            type="button"
            onClick={closeSave}
            disabled={isSaving}
            className="rounded-xl border border-line bg-canvas px-3 py-3 text-xs font-bold disabled:opacity-40"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={
              !outfitName.trim() ||
              !outfitStyle ||
              outfitSeasons.length === 0 ||
              isSaving
            }
            className="rounded-xl bg-accent px-3 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving
              ? '저장 중...'
              : !outfitName.trim()
                ? '이름을 입력해주세요'
                : !outfitStyle
                  ? '스타일을 골라주세요'
                  : outfitSeasons.length === 0
                    ? '계절을 골라주세요'
                    : includesPreview
                      ? 'AI 룩과 함께 저장'
                      : '코디북에 저장'}
          </button>
        </footer>
      </form>
    </div>
  )
}
