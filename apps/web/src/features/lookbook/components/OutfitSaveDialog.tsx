import { BookHeart, Sparkles, X } from 'lucide-react'
import { SeasonMultiSelect } from '../../../components/SeasonMultiSelect'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import { useOutfitComposer } from '../contexts/OutfitComposerContext'
import { OutfitStyleSelector } from './OutfitStyleSelector'

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
    setOutfitName,
    setOutfitStyle,
    setOutfitSeasons,
    saveOutfit,
    closeSave,
  } = useOutfitComposer()
  if (!isSaveOpen) return null

  return (
    <div
      className="classification-page-enter fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-3 backdrop-blur-[2px] sm:p-6"
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
          saveOutfit()
        }}
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-sm flex-col overflow-hidden rounded-[1.75rem] bg-surface shadow-2xl sm:max-h-[calc(100dvh-3rem)]"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-4">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-sage text-ink">
            <BookHeart size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="outfit-save-title" className="text-base font-black">
              코디북에 추가
            </h2>
            <p className="mt-0.5 text-[11px] text-muted">
              이름과 스타일, 입을 계절을 확인해주세요.
            </p>
          </div>
          <button
            type="button"
            onClick={closeSave}
            disabled={isSaving}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink disabled:opacity-40"
            aria-label="코디 저장 닫기"
          >
            <X size={18} />
          </button>
        </header>

        <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="scrollbar-hidden flex gap-2 overflow-x-auto pb-1">
            {selectedItems.map((item) => (
              <div className="w-16 shrink-0" key={item.id}>
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-line bg-canvas p-1">
                  <ClosetItemVisual item={item} compact />
                </div>
                <span className="mt-1 block truncate text-center text-[9px] font-bold">
                  {item.name}
                </span>
              </div>
            ))}
          </div>

          <label className="mt-5 grid gap-2 text-xs font-black">
            코디 이름
            <input
              type="text"
              value={outfitName}
              onChange={(event) => setOutfitName(event.target.value)}
              placeholder="코디 이름을 입력해주세요"
              maxLength={40}
              className="h-12 rounded-xl border border-line bg-canvas px-3 text-sm font-bold outline-none transition focus:border-accent"
              autoFocus
              required
            />
          </label>

          <fieldset className="mt-5">
            <legend className="text-xs font-black">코디 스타일</legend>
            <div className="mt-2">
              <OutfitStyleSelector
                value={outfitStyle}
                options={styleOptions}
                onChange={setOutfitStyle}
              />
            </div>
          </fieldset>

          <fieldset className="mt-5">
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
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-sage px-3 py-2.5 text-[11px] font-bold text-ink">
              <Sparkles size={14} className="shrink-0 text-accent" />
              AI 룩 이미지도 함께 저장돼요.
            </div>
          )}
        </div>

        <footer className="grid shrink-0 grid-cols-[0.75fr_1.25fr] gap-2 border-t border-line px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
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
