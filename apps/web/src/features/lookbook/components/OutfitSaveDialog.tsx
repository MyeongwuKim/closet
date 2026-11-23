import { useId, type Ref } from 'react'
import { BookHeart, Sparkles, X } from 'lucide-react'
import { SeasonMultiSelect } from '../../../components/SeasonMultiSelect'
import { useOutfitComposer, type OutfitComposerSession } from '../contexts/OutfitComposerContext'
import { ComposerLookCanvas } from './ComposerLookCanvas'
import { OutfitStyleSelector } from './OutfitStyleSelector'
import { OutfitSavingState } from './OutfitSavingState'

/** 코디 맞춰보기에서 저장 단계가 열렸을 때 편집 세션을 공통 저장 화면에 연결한다. */
export function OutfitSaveDialog({ plannerLabel }: { plannerLabel?: string }) {
  const session = useOutfitComposer()
  return session.isSaveOpen ? <OutfitSaveDialogView {...session} plannerLabel={plannerLabel} /> : null
}

type OutfitSaveDialogViewProps = Pick<OutfitComposerSession,
  | 'selectedItems'
  | 'outfitName'
  | 'outfitStyle'
  | 'outfitSeasons'
  | 'styleOptions'
  | 'includesPreview'
  | 'isSaving'
  | 'isPersisting'
  | 'setOutfitName'
  | 'setOutfitStyle'
  | 'setOutfitSeasons'
  | 'saveOutfit'
  | 'closeSave'
> & {
  dialogRef?: Ref<HTMLDivElement>
  errorMessage?: string | null
  seasonDescription?: string
  plannerLabel?: string
}

/** 코디북에 저장할 조합과 이름·스타일·계절을 확인한다. 저장 실행과 실패 상태는 호출 화면에서 관리한다. */
export function OutfitSaveDialogView({
  selectedItems,
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
  dialogRef,
  errorMessage,
  seasonDescription = '선택한 옷의 공통 계절을 먼저 표시해요.',
  plannerLabel,
}: OutfitSaveDialogViewProps) {
  const titleId = useId()

  return (
    <div
      ref={dialogRef}
      className="classification-page-enter fixed inset-0 z-[120] flex items-center justify-center bg-ink/40 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
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
            <h2 id={titleId} className="mt-0.5 text-lg font-semibold leading-tight">
              {plannerLabel ? '플래너에 넣을 코디' : '이 코디를 저장할까요?'}
            </h2>
            <p className="mt-1 text-[11px] text-muted">
              {plannerLabel ? '이름, 스타일, 계절을 정할 수 있어요.' : '이름, 스타일, 계절을 확인하고 저장해주세요.'}
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
              <section aria-label="완성한 코디 미리보기" className="min-w-0">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="mt-1 text-sm font-bold text-ink">선택한 옷</p>
                  </div>
                  <span className="text-[11px] text-muted">{selectedItems.length}개의 아이템</span>
                </div>
                <ComposerLookCanvas
                  className="composer-look-canvas--review"
                  selectedItems={selectedItems}
                  lookName={outfitName}
                />
              </section>

              <section aria-label="코디 정보" className="min-w-0 border-t border-line pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
                <h3 className="mt-1 text-xl font-semibold text-ink">코디 정보</h3>
                <p className="mt-1 text-xs leading-5 text-muted">
                  나중에 찾기 쉽도록 이름과 스타일을 정해주세요.
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
                    required={!plannerLabel}
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
                    {seasonDescription}
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
                    AI 룩북도 함께 저장돼요.
                  </div>
                )}
                {errorMessage && (
                  <p role="alert" className="mt-4 text-xs font-bold text-danger">{errorMessage}</p>
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
              isSaving || (!plannerLabel && (!outfitName.trim() || !outfitStyle || outfitSeasons.length === 0))
            }
            className="rounded-xl bg-accent px-3 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving
              ? '저장 중…'
              : plannerLabel ?? (!outfitName.trim()
                ? '이름을 입력해주세요'
                : !outfitStyle
                  ? '스타일을 골라주세요'
                  : outfitSeasons.length === 0
                    ? '계절을 골라주세요'
                    : includesPreview
                      ? 'AI 룩북과 함께 저장'
                      : '코디북에 저장')}
          </button>
        </footer>
      </form>
    </div>
  )
}
