import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type {
  ClothingCategory,
  FashionItemAttributes,
  Season,
  WardrobeItem,
} from '@closet/types'
import { ChevronLeft, Save } from 'lucide-react'
import { OptionPickerField } from '../../../components/OptionPickerField'
import { SeasonMultiSelect } from '../../../components/SeasonMultiSelect'
import { CategoryMultiSelectField } from './CategoryMultiSelectField'
import { ClosetItemVisual } from './ClosetItemVisual'
import { WardrobeTagField } from './WardrobeTagField'
import { WardrobeStorageLocationField } from './WardrobeStorageLocationField'
import { FashionAttributeFields } from './FashionAttributeFields'
import { WardrobeBrandField } from './WardrobeBrandField'
import { closetSubcategoryOptions } from '../constants'
import { useStoredWardrobeShapeAnalysis } from '../hooks/useStoredWardrobeShapeAnalysis'
import { useClosetStore } from '../stores/useClosetStore'
import {
  GarmentSizeFields,
} from './GarmentSizeFields'
import {
  garmentSizeFromItem,
  toGarmentSizeInput,
  type GarmentSizeFormValue,
  type GarmentSizeInput,
} from '../utils/garmentSize'
import {
  fashionAttributesFromItem,
  mergeEditableFashionAttributes,
  type EditableFashionAttributes,
} from '../utils/fashionAttributes'

export interface ClosetItemUpdates {
  name: string
  brandName: string | null
  storageLocation: string | null
  category: ClothingCategory
  additionalCategories: ClothingCategory[]
  subcategory: string
  colorName: string
  colorHex: string
  fashionAttributes: FashionItemAttributes
  seasons: Season[]
  tags: string[]
}

export type ClosetItemUpdateInput = ClosetItemUpdates & GarmentSizeInput

interface ClosetItemEditModalProps {
  item: WardrobeItem
  onClose: () => void
  onSave: (updates: ClosetItemUpdateInput) => Promise<void>
}

/** 옷 상세에서 직접 수정하거나 기존 사진으로 찾은 형태 정보를 확인한 뒤 함께 저장한다. */
export function ClosetItemEditModal({
  item,
  onClose,
  onSave,
}: ClosetItemEditModalProps) {
  const [name, setName] = useState(item.name)
  const [brandName, setBrandName] = useState(item.brandName ?? '')
  const [storageLocation, setStorageLocation] = useState(item.storageLocation ?? '')
  const [category, setCategory] = useState<ClothingCategory | ''>(
    item.category ?? '',
  )
  const [additionalCategories, setAdditionalCategories] = useState(
    item.additionalCategories,
  )
  const [subcategory, setSubcategory] = useState(item.subcategory ?? '')
  const [colorName, setColorName] = useState(item.colorName)
  const [seasons, setSeasons] = useState<Season[]>(item.seasons)
  const shapeAnalysis = useStoredWardrobeShapeAnalysis(item, category)
  const isAnalyzing = shapeAnalysis.state.status === 'analyzing'
  const baseAttributes = shapeAnalysis.state.status === 'ready'
    ? shapeAnalysis.state.attributes
    : item.fashionAttributes
  // 사진 분석 중 직접 바꾼 소재나 보온감도 저장할 때 우선한다.
  const [fashionEdits, setFashionEdits] = useState<Partial<EditableFashionAttributes>>({})
  const fashionAttributes = { ...fashionAttributesFromItem(baseAttributes), ...fashionEdits }
  const [tags, setTags] = useState<string[]>(item.tags)
  const wardrobeItems = useClosetStore((state) => state.items)
  const tagSuggestions = wardrobeItems.flatMap(
    (wardrobeItem) => wardrobeItem.tags,
  )
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
      isSaving ||
      isAnalyzing ||
      !name.trim() ||
      !category ||
      !subcategory.trim() ||
      !colorName.trim() ||
      seasons.length === 0 ||
      !shapeAnalysis.ensureCurrentSession()
    ) {
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        name: name.trim(),
        brandName: brandName.trim() || null,
        storageLocation: storageLocation.trim() || null,
        category,
        additionalCategories,
        subcategory: subcategory.trim(),
        colorName: colorName.trim(),
        colorHex: item.colorHex,
        fashionAttributes: mergeEditableFashionAttributes(
          baseAttributes,
          fashionAttributes,
          category,
        ),
        seasons,
        tags,
        ...toGarmentSizeInput(category, garmentSize),
      })
    } catch {
      setIsSaving(false)
    }
  }

  const changeCategories = (nextCategories: ClothingCategory[]) => {
    const [nextCategory, ...nextAdditionalCategories] = nextCategories
    if (!nextCategory) return

    if (nextCategory !== category) shapeAnalysis.reset()
    setCategory(nextCategory)
    setAdditionalCategories(nextAdditionalCategories)
    if (!closetSubcategoryOptions[nextCategory].includes(subcategory)) {
      setSubcategory(closetSubcategoryOptions[nextCategory][0] ?? '')
    }
  }

  const changeFashionAttributes = (next: EditableFashionAttributes) => {
    setFashionEdits((edits) => ({
      ...edits,
      ...(next.material !== fashionAttributes.material ? { material: next.material } : {}),
      ...(next.warmth !== fashionAttributes.warmth ? { warmth: next.warmth } : {}),
    }))
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
            <h2 id="closet-item-edit-title" className="text-lg font-semibold">
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
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-3xl bg-surface border border-line">
              <ClosetItemVisual item={item} />
            </div>

            <div className="grid content-start gap-4">
              {shapeAnalysis.canAnalyze && shapeAnalysis.state.status !== 'ready' && (
                <button
                  type="button"
                  onClick={() => void shapeAnalysis.analyze()}
                  disabled={isSaving || isAnalyzing}
                  className="min-h-12 rounded-xl border border-line bg-surface px-3 text-sm font-bold disabled:opacity-50"
                >
                  {isAnalyzing ? '형태 분석 중…' : '기존 사진으로 형태 분석'}
                </button>
              )}
              {shapeAnalysis.state.status === 'ready' && (
                <p role="status" className="text-sm text-muted">
                  형태 정보를 찾았어요. 저장하면 옷장에 반영돼요.
                </p>
              )}
              {shapeAnalysis.state.status === 'error' && (
                <p role="alert" className="text-sm text-red-700">
                  {shapeAnalysis.state.message}
                </p>
              )}
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

              <WardrobeBrandField
                value={brandName}
                onChange={setBrandName}
              />

              <CategoryMultiSelectField
                value={category ? [category, ...additionalCategories] : []}
                onChange={changeCategories}
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

              <FashionAttributeFields
                value={fashionAttributes}
                onChange={changeFashionAttributes}
              />

              <GarmentSizeFields
                category={category}
                value={garmentSize}
                onChange={setGarmentSize}
              />

              <WardrobeTagField
                value={tags}
                suggestions={tagSuggestions}
                onChange={setTags}
                defaultOpen={tags.length > 0}
              />
              <WardrobeStorageLocationField value={storageLocation} onChange={setStorageLocation} disabled={isSaving} />
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
                isAnalyzing ||
                !name.trim() ||
                !category ||
                !subcategory.trim() ||
                !colorName.trim() ||
                seasons.length === 0
              }
              className="flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              <Save size={17} />
              {isSaving ? '저장 중…' : '변경사항 저장'}
            </button>
          </div>
        </footer>
      </form>
    </section>
  )
}
