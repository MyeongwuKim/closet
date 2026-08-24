import type { ClothingCategory } from '@closet/types'
import { ChevronLeft } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { closetCategoryLabels } from '../constants'

interface ClosetCategoryFilterProps {
  className?: string
  category: ClothingCategory | null
  subcategory: string | null
  availableCategories: ClothingCategory[]
  availableSubcategories: string[]
  onCategoryChange: (value: ClothingCategory | null) => void
  onSubcategoryChange: (value: string | null) => void
}

export function ClosetCategoryFilter({
  className = 'mt-6',
  category,
  subcategory,
  availableCategories,
  availableSubcategories,
  onCategoryChange,
  onSubcategoryChange,
}: ClosetCategoryFilterProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const activeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      const container = scrollContainerRef.current
      const activeButton = activeButtonRef.current
      if (!container || !activeButton) return

      const containerRect = container.getBoundingClientRect()
      const buttonRect = activeButton.getBoundingClientRect()
      const nextScrollLeft =
        container.scrollLeft +
        buttonRect.left -
        containerRect.left -
        (containerRect.width - buttonRect.width) / 2

      container.scrollTo({
        left: nextScrollLeft,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
      })
    })

    return () => window.cancelAnimationFrame(animationFrame)
  }, [category, subcategory])

  const selectCategory = (nextCategory: ClothingCategory | null) => {
    onCategoryChange(nextCategory)
  }

  return (
    <div
      ref={scrollContainerRef}
      className={`scrollbar-hidden flex gap-2 overflow-x-auto pb-2 ${className}`}
      aria-label={category ? `${closetCategoryLabels[category]} 세부 종류` : '옷 카테고리'}
    >
      {category === null ? (
        <>
          <button
            ref={activeButtonRef}
            type="button"
            onClick={() => selectCategory(null)}
            className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-bold text-white"
          >
            전체
          </button>
          {availableCategories.map((availableCategory) => (
            <button
              type="button"
              onClick={() => selectCategory(availableCategory)}
              className="shrink-0 rounded-full border border-line bg-surface px-4 py-2 text-sm font-bold text-muted hover:text-ink"
              key={availableCategory}
            >
              {closetCategoryLabels[availableCategory]}
            </button>
          ))}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => selectCategory(null)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-muted hover:border-ink hover:text-ink"
            aria-label="큰 카테고리로 돌아가기"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            ref={subcategory === null ? activeButtonRef : undefined}
            type="button"
            onClick={() => onSubcategoryChange(null)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
              subcategory === null
                ? 'bg-ink text-white'
                : 'border border-line bg-surface text-muted hover:text-ink'
            }`}
          >
            {closetCategoryLabels[category]} 전체
          </button>
          {availableSubcategories.map((availableSubcategory) => (
            <button
              ref={
                subcategory === availableSubcategory
                  ? activeButtonRef
                  : undefined
              }
              type="button"
              onClick={() => onSubcategoryChange(availableSubcategory)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
                subcategory === availableSubcategory
                  ? 'bg-ink text-white'
                  : 'border border-line bg-surface text-muted hover:text-ink'
              }`}
              key={availableSubcategory}
            >
              {availableSubcategory}
            </button>
          ))}
        </>
      )}
    </div>
  )
}
