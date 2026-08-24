import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type {
  ClothingCategory,
  ColorMode,
  Season,
  WardrobeItem,
} from '@closet/types'
import { ChevronLeft, Palette, Sparkles } from 'lucide-react'
import {
  useUiStore,
  type ClassificationCandidate,
} from '../stores/useUiStore'
import { closetSubcategoryOptions } from '../features/closet/constants'
import { OptionPickerField } from './OptionPickerField'
import { SeasonMultiSelect } from './SeasonMultiSelect'
import { WardrobeSavingOverlay } from './WardrobeSavingOverlay'
import {
  GarmentSizeFields,
} from '../features/closet/components/GarmentSizeFields'
import { SimilarWardrobeItems } from '../features/closet/components/SimilarWardrobeItems'
import { CategoryMultiSelectField } from '../features/closet/components/CategoryMultiSelectField'
import { WardrobeTagField } from '../features/closet/components/WardrobeTagField'
import {
  emptyGarmentSize,
  toGarmentSizeInput,
  type GarmentSizeFormValue,
  type GarmentSizeInput,
} from '../features/closet/utils/garmentSize'

const colorModeLabels: Record<ColorMode, string> = {
  solid: '단색',
  patterned: '패턴',
  multicolor: '다색',
}

interface ClassificationConfirmModalProps {
  candidate: ClassificationCandidate
  wardrobeItems: WardrobeItem[]
  onConfirm: (
    itemId: string,
    result: {
      name: string
      category: ClothingCategory
      additionalCategories: ClothingCategory[]
      subcategory: string
      colorName: string
      colorDetailName: string | null
      colorHex: string
      colorMode: ColorMode | null
      seasons: Season[]
      tags: string[]
    } & GarmentSizeInput,
  ) => Promise<void>
}

export function ClassificationConfirmModal({
  candidate,
  wardrobeItems,
  onConfirm,
}: ClassificationConfirmModalProps) {
  const completeClassification = useUiStore(
    (state) => state.completeClassification,
  )
  const cancelClassification = useUiStore(
    (state) => state.cancelClassification,
  )
  const [category, setCategory] = useState<ClothingCategory | ''>(
    candidate.category ?? '',
  )
  const [additionalCategories, setAdditionalCategories] = useState<
    ClothingCategory[]
  >([])
  const [name, setName] = useState(candidate.itemName)
  const [subcategory, setSubcategory] = useState(candidate.subcategory)
  const [colorName, setColorName] = useState(candidate.colorName)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [garmentSize, setGarmentSize] =
    useState<GarmentSizeFormValue>(emptyGarmentSize)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelClassification()
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [cancelClassification])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (
      !name.trim() ||
      !category ||
      !subcategory.trim() ||
      !colorName.trim() ||
      seasons.length === 0
    ) {
      return
    }

    setIsSaving(true)
    try {
      await onConfirm(candidate.itemId, {
        name: name.trim(),
        category,
        additionalCategories,
        subcategory: subcategory.trim(),
        colorName: colorName.trim(),
        colorDetailName: candidate.colorDetailName.trim() || null,
        colorHex: candidate.colorHex,
        colorMode: candidate.colorMode,
        seasons,
        tags,
        ...toGarmentSizeInput(category, garmentSize),
      })
      completeClassification()
    } catch {
      setIsSaving(false)
    }
  }

  const changeCategories = (nextCategories: ClothingCategory[]) => {
    const [nextCategory, ...nextAdditionalCategories] = nextCategories
    if (!nextCategory) return

    if (
      nextCategory !== category &&
      !closetSubcategoryOptions[nextCategory].includes(subcategory)
    ) {
      setSubcategory(closetSubcategoryOptions[nextCategory][0] ?? '')
    }
    setCategory(nextCategory)
    setAdditionalCategories(nextAdditionalCategories)
  }

  const promoteCandidateCategory = (
    nextCategory: ClothingCategory,
    nextSubcategory: string,
  ) => {
    const currentCategories = category
      ? [category, ...additionalCategories]
      : additionalCategories
    setCategory(nextCategory)
    setAdditionalCategories(
      currentCategories
        .filter((currentCategory) => currentCategory !== nextCategory)
        .slice(0, 2),
    )
    setSubcategory(nextSubcategory)
  }

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="classification-modal-title"
      className="classification-page-enter fixed inset-0 z-[80] flex h-dvh flex-col overflow-hidden bg-canvas"
    >
      <header className="shrink-0 border-b border-line bg-canvas pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-16 max-w-3xl items-center gap-3 px-4 sm:min-h-18 sm:px-6">
          <button
            type="button"
            onClick={cancelClassification}
            className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-surface"
            aria-label="옷 추가 취소"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="min-w-0">
            <h2
              id="classification-modal-title"
              className="truncate text-lg font-black tracking-[-0.03em] sm:text-xl"
            >
              AI 분석 결과
            </h2>
            <p className="mt-0.5 truncate text-xs text-muted">
              결과를 확인하고 내 옷장에 저장하세요.
            </p>
          </div>
        </div>
      </header>

      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={handleSubmit}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto grid max-w-3xl gap-5 px-5 py-6 sm:px-6 sm:py-8">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-sage px-3 py-2 text-xs font-bold">
                <Sparkles size={14} />
                {candidate.analysisFailed
                  ? '수동 확인 필요'
                  : 'AI 분석 완료'}
              </span>
              <h3 className="mt-4 text-2xl font-black tracking-tight">
                {candidate.analysisFailed
                  ? '옷 정보를 직접 확인해주세요'
                  : '이렇게 분류하면 될까요?'}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                이름을 정하고 분석된 카테고리와 색상을 확인해주세요.
              </p>
            </div>

            <div className="flex aspect-[1.4] max-h-105 items-center justify-center overflow-hidden rounded-2xl bg-surface shadow-[inset_0_0_0_1px_#dedad1]">
              <img
                src={candidate.imageUrl}
                alt={candidate.itemName}
                className="detail-image-enter h-full w-full object-contain p-3"
              />
            </div>

            <div className="grid gap-4">
              {!candidate.analysisFailed && (
                <section
                  className="rounded-2xl border border-line bg-surface p-4"
                  aria-label="AI 색상 분석"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="size-14 shrink-0 rounded-2xl border border-black/10 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.45)]"
                      style={{ backgroundColor: candidate.colorHex }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-muted">
                        <Palette size={14} /> AI 색상 분석
                      </p>
                      <p className="mt-1 truncate text-base font-black">
                        {candidate.colorDetailName || candidate.colorName}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        넓은 분류 {candidate.colorName}
                        {candidate.colorMode
                          ? ` · ${colorModeLabels[candidate.colorMode]}`
                          : ''}
                      </p>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white px-3 py-2.5">
                      <dt className="text-[11px] font-bold text-muted">HEX</dt>
                      <dd className="mt-0.5 font-mono text-sm font-bold">
                        {candidate.colorHex.toUpperCase()}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2.5">
                      <dt className="text-[11px] font-bold text-muted">RGB</dt>
                      <dd className="mt-0.5 font-mono text-sm font-bold">
                        {candidate.colorRgb.join(', ')}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs leading-5 text-muted">
                    배경을 제외하고 옷 원단에서 찾은 대표색이에요. 패턴 옷은
                    가장 넓은 바탕색을 표시해요.
                  </p>
                </section>
              )}

              <label className="grid gap-2 text-sm font-bold">
                아이템 이름
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="예: 브라운 레더 벨트"
                  maxLength={40}
                  className="h-12 rounded-xl border border-line bg-white px-3 text-ink outline-none focus:border-accent"
                  required
                />
              </label>

              <CategoryMultiSelectField
                value={category ? [category, ...additionalCategories] : []}
                onChange={changeCategories}
                required
              />

              <OptionPickerField
                label="세부 종류"
                value={subcategory}
                options={(category
                  ? closetSubcategoryOptions[category]
                  : []
                ).map((option) => ({ value: option, label: option }))}
                placeholder={
                  category
                    ? '세부 종류를 선택해주세요'
                    : '카테고리를 먼저 선택해주세요'
                }
                onChange={setSubcategory}
                disabled={!category}
                required
              />

              <label className="grid gap-2 text-sm font-bold">
                대표 색상
                <input
                  type="text"
                  value={colorName}
                  onChange={(event) => setColorName(event.target.value)}
                  placeholder="예: 차콜, 크림, 네이비"
                  maxLength={30}
                  className="h-12 rounded-xl border border-line bg-white px-3 text-ink outline-none focus:border-accent"
                  required
                />
                <span className="text-xs font-normal leading-5 text-muted">
                  AI가 찾은 색상이며 원하는 표현으로 직접 바꿀 수 있어요.
                </span>
              </label>

              <fieldset>
                <legend className="text-sm font-bold">입을 계절</legend>
                <p className="mt-1 text-xs leading-5 text-muted">
                  여러 계절을 함께 선택할 수 있어요.
                </p>
                <div className="mt-2">
                  <SeasonMultiSelect value={seasons} onChange={setSeasons} />
                </div>
              </fieldset>

              <GarmentSizeFields
                category={category}
                value={garmentSize}
                onChange={setGarmentSize}
              />

              <WardrobeTagField
                value={tags}
                suggestions={wardrobeItems.flatMap((item) => item.tags)}
                onChange={setTags}
              />

              {!candidate.analysisFailed &&
                candidate.candidates.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-muted">
                      판별 상위 후보
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {candidate.candidates.map((item) => (
                        <button
                          type="button"
                          onClick={() => {
                            promoteCandidateCategory(item.category, item.label)
                          }}
                          className="rounded-full border border-line bg-surface px-3 py-2 text-xs font-bold hover:border-accent"
                          key={`${item.category}-${item.subcategory}`}
                        >
                          {item.label} {Math.round(item.score * 100)}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              {!candidate.analysisFailed && category && subcategory.trim() && (
                <SimilarWardrobeItems
                  category={category}
                  subcategory={subcategory}
                  colorName={candidate.colorName}
                  colorHex={candidate.colorHex}
                  colorMode={candidate.colorMode}
                  wardrobeItems={wardrobeItems}
                />
              )}
            </div>
          </div>
        </div>

        <footer className="shrink-0 border-t border-line bg-surface px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(27,27,24,0.06)]">
          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3">
            <button
              type="button"
              onClick={cancelClassification}
              className="rounded-xl border border-line px-4 py-3 text-sm font-bold hover:border-ink"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={
                isSaving ||
                !name.trim() ||
                !category ||
                !subcategory.trim() ||
                !colorName.trim() ||
                seasons.length === 0
              }
              className="rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving ? '옷장에 넣는 중...' : '옷장에 추가'}
            </button>
          </div>
        </footer>
      </form>

      {isSaving && <WardrobeSavingOverlay />}
    </section>
  )
}
