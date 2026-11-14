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
  /** 옵션을 처음 조회하는 동안 같은 높이에 종류 버튼의 자리를 유지한다. */
  isLoading?: boolean
  onCategoryChange: (value: ClothingCategory | null) => void
  onSubcategoryChange: (value: string | null) => void
}

export function ClosetCategoryFilter({
  className = 'mt-6',
  category,
  subcategory,
  availableCategories,
  availableSubcategories,
  isLoading = false,
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
  }, [category, subcategory, isLoading])

  const selectCategory = (nextCategory: ClothingCategory | null) => {
    onCategoryChange(nextCategory)
  }

  return (
    <div
      ref={scrollContainerRef}
      className={`scrollbar-hidden flex gap-2 overflow-x-auto pb-1 ${className}`}
      aria-label={category ? `${closetCategoryLabels[category]} 세부 종류` : '옷 카테고리'}
      aria-busy={isLoading}
      inert={isLoading}
    >
      {isLoading ? (
        Array.from({ length: 4 }, (_, index) => <span className="h-9 w-16 shrink-0 animate-pulse rounded-full bg-line/40" aria-hidden="true" key={index} />)
      ) : category === null ? (
        <>
          <button
            ref={activeButtonRef}
            type="button"
            onClick={() => selectCategory(null)}
            className="flex h-9 shrink-0 items-center rounded-full bg-ink px-4 text-sm font-medium text-white"
          >
            전체
          </button>
          {availableCategories.map((availableCategory) => (
            <button
              type="button"
              onClick={() => selectCategory(availableCategory)}
              className="flex h-9 shrink-0 items-center rounded-full border border-line bg-surface px-4 text-sm font-medium text-muted hover:text-ink"
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
            className={`flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium ${
              subcategory === null
                ? 'bg-accent text-surface'
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
              className={`flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium ${
                subcategory === availableSubcategory
                  ? 'bg-accent text-surface'
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
