import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type {
  ClothingCategory,
  Season,
  WardrobeItem,
} from '@closet/types'
import { ChevronLeft, Save } from 'lucide-react'
import { OptionPickerField } from '../../../components/OptionPickerField'
import { SeasonMultiSelect } from '../../../components/SeasonMultiSelect'
import { ClosetItemVisual } from './ClosetItemVisual'
import {
  closetCategoryLabels,
  closetSubcategoryOptions,
} from '../constants'
import {
  GarmentSizeFields,
} from './GarmentSizeFields'
import {
  garmentSizeFromItem,
  toGarmentSizeInput,
  type GarmentSizeFormValue,
  type GarmentSizeInput,
} from '../utils/garmentSize'

const categoryOptions = Object.entries(closetCategoryLabels).map(
  ([value, label]) => ({ value, label }),
)

export interface ClosetItemUpdates {
  name: string
  category: ClothingCategory
  subcategory: string
  colorName: string
  colorHex: string
  seasons: Season[]
}

export type ClosetItemUpdateInput = ClosetItemUpdates & GarmentSizeInput

interface ClosetItemEditModalProps {
  item: WardrobeItem
  onClose: () => void
  onSave: (updates: ClosetItemUpdateInput) => Promise<void>
}

export function ClosetItemEditModal({
  item,
  onClose,
  onSave,
}: ClosetItemEditModalProps) {
  const [name, setName] = useState(item.name)
  const [category, setCategory] = useState<ClothingCategory | ''>(
    item.category ?? '',
  )
  const [subcategory, setSubcategory] = useState(item.subcategory ?? '')
  const [colorName, setColorName] = useState(item.colorName)
  const [seasons, setSeasons] = useState<Season[]>(item.seasons)
  const [garmentSize, setGarmentSize] = useState<GarmentSizeFormValue>(() =>
    garmentSizeFromItem(item),
  )
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

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
      await onSave({
        name: name.trim(),
        category,
        subcategory: subcategory.trim(),
        colorName: colorName.trim(),
        colorHex: item.colorHex,
        seasons,
        ...toGarmentSizeInput(category, garmentSize),
      })
    } catch {
      setIsSaving(false)
    }
  }

  const changeCategory = (nextCategory: ClothingCategory) => {
    setCategory(nextCategory)
    if (!closetSubcategoryOptions[nextCategory].includes(subcategory)) {
      setSubcategory(closetSubcategoryOptions[nextCategory][0] ?? '')
    }
  }

  return (
    <section
      className="classification-page-enter fixed inset-0 z-[80] flex h-dvh flex-col overflow-hidden bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-labelledby="closet-item-edit-title"
    >
      <header className="shrink-0 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-3xl items-center gap-2 px-3 py-2 sm:min-h-18 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-full hover:bg-surface"
            aria-label="정보 수정 닫기"
            autoFocus
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 id="closet-item-edit-title" className="text-lg font-black">
              옷 정보 수정
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              AI 판별 결과를 직접 바꿀 수 있어요.
            </p>
          </div>
        </div>
      </header>

      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto grid max-w-3xl gap-5 px-5 py-6 sm:grid-cols-[220px_minmax(0,1fr)] sm:px-6 sm:py-8">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-3xl bg-surface shadow-[inset_0_0_0_1px_#dedad1]">
              <ClosetItemVisual item={item} />
            </div>

            <div className="grid content-start gap-4">
              <label className="grid gap-2 text-sm font-bold">
                아이템 이름
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-12 rounded-xl border border-line bg-white px-3 outline-none focus:border-accent"
                  maxLength={40}
                  required
                />
              </label>

              <OptionPickerField
                label="카테고리"
                value={category}
                options={categoryOptions}
                placeholder="카테고리를 선택해주세요"
                onChange={(value) =>
                  changeCategory(value as ClothingCategory)
                }
                required
              />

              <OptionPickerField
                label="세부 카테고리"
                value={subcategory}
                options={(category
                  ? closetSubcategoryOptions[category]
                  : []
                ).map((option) => ({ value: option, label: option }))}
                placeholder={
                  category
                    ? '세부 카테고리를 선택해주세요'
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
                  className="h-12 rounded-xl border border-line bg-white px-3 outline-none focus:border-accent"
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
            </div>
          </div>
        </div>

        <footer className="shrink-0 border-t border-line bg-surface px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-line px-4 py-3 text-sm font-bold"
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
              className="flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              <Save size={17} />
              {isSaving ? '저장 중...' : '변경사항 저장'}
            </button>
          </div>
        </footer>
      </form>
    </section>
  )
}
