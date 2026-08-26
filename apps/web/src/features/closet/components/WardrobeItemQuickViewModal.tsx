import { useEffect, useId } from 'react'
import type { WardrobeItem } from '@closet/types'
import { CalendarDays, Palette, Ruler, Tag, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { seasonLabels } from '../../../constants/seasons'
import { formatRecentWearLabel } from '../../../utils/wearDate'
import { closetCategoryLabels } from '../constants'
import { colorHexToRgb, colorModeLabels } from '../utils/color'
import { getWardrobeItemCategories } from '../utils/wardrobeCategories'
import { ClosetItemVisual } from './ClosetItemVisual'

interface WardrobeItemQuickViewModalProps {
  item: WardrobeItem
  onClose: () => void
}

const sizeLabels = {
  sizeLabel: '표기 사이즈',
  shoulderWidthCm: '어깨너비',
  chestWidthCm: '가슴 단면',
  sleeveLengthCm: '소매 길이',
  totalLengthCm: '총장',
  waistWidthCm: '허리 단면',
  hipWidthCm: '엉덩이 단면',
  inseamCm: '인심',
  thighWidthCm: '허벅지 단면',
  riseCm: '밑위',
  hemWidthCm: '밑단 단면',
} as const

export function WardrobeItemQuickViewModal({
  item,
  onClose,
}: WardrobeItemQuickViewModalProps) {
  const titleId = useId()
  const colorRgb = colorHexToRgb(item.colorHex)
  const categories = getWardrobeItemCategories(item)
  const wearLabel = item.lastWornAt
    ? (formatRecentWearLabel(item.lastWornAt) ?? '최근 착용')
    : null
  const sizes = Object.entries(sizeLabels).flatMap(([key, label]) => {
    const value = item[key as keyof typeof sizeLabels]
    return value === undefined || value === '' ? [] : [{ label, value }]
  })

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      onClose()
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [onClose])

  return createPortal(
    <div
      className="option-picker-backdrop fixed inset-0 z-[130] flex items-center justify-center bg-ink/45 px-4 py-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="option-picker-enter flex max-h-[calc(100dvh-3rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-muted">옷장 아이템 상세정보</p>
            <h2 id={titleId} className="mt-0.5 truncate text-xl font-black">
              {item.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-canvas text-muted hover:text-ink"
            aria-label="아이템 상세정보 닫기"
            autoFocus
          >
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto overscroll-contain p-5">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:items-start">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-canvas shadow-[inset_0_0_0_1px_#dedad1]">
              <ClosetItemVisual item={item} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                {categories.map((category, index) => (
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                      index === 0
                        ? 'bg-ink text-white'
                        : 'border border-line bg-canvas text-muted'
                    }`}
                    key={category}
                  >
                    {closetCategoryLabels[category]}
                  </span>
                ))}
                {item.subcategory && (
                  <span className="rounded-full border border-line bg-canvas px-3 py-1.5 text-xs font-bold text-muted">
                    {item.subcategory}
                  </span>
                )}
              </div>

              <div className="mt-4 grid gap-2 text-sm text-muted">
                <p className="flex items-center gap-2">
                  <CalendarDays size={15} />
                  {new Intl.DateTimeFormat('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }).format(new Date(item.createdAt))}{' '}
                  등록
                </p>
                {wearLabel && (
                  <p className="flex items-center gap-2">
                    <CalendarDays size={15} />
                    {wearLabel} · 총 {item.wearCount}회
                  </p>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-line bg-canvas p-4">
                <div className="flex items-center gap-3">
                  <span
                    className="size-11 shrink-0 rounded-xl border border-black/10"
                    style={{ backgroundColor: item.colorHex }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-muted">
                      <Palette size={14} /> 대표 색상
                    </p>
                    <p className="mt-1 truncate text-sm font-black">
                      {item.colorDetailName ?? item.colorName}
                    </p>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-muted">HEX</dt>
                    <dd className="mt-0.5 font-mono font-bold">
                      {item.colorHex.toUpperCase()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">RGB</dt>
                    <dd className="mt-0.5 font-mono font-bold">
                      {colorRgb?.join(', ') ?? '확인 불가'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">넓은 분류</dt>
                    <dd className="mt-0.5 font-bold">{item.colorName}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">색상 구성</dt>
                    <dd className="mt-0.5 font-bold">
                      {item.colorMode
                        ? colorModeLabels[item.colorMode]
                        : '미분류'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          {(item.seasons.length > 0 || item.tags.length > 0) && (
            <div className="mt-5 rounded-2xl border border-line bg-canvas p-4">
              <div className="flex flex-wrap gap-2">
                {item.seasons.map((season) => (
                  <span
                    className="rounded-full bg-sage px-3 py-1.5 text-xs font-bold"
                    key={season}
                  >
                    {seasonLabels[season]}
                  </span>
                ))}
                {item.tags.map((tag) => (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-bold"
                    key={tag}
                  >
                    <Tag size={12} /> #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {sizes.length > 0 && (
            <div className="mt-5 rounded-2xl border border-line bg-canvas p-4">
              <p className="flex items-center gap-2 text-xs font-black">
                <Ruler size={14} /> 사이즈 정보
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                {sizes.map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-[11px] text-muted">{label}</dt>
                    <dd className="mt-0.5 text-sm font-bold">
                      {value}
                      {label !== '표기 사이즈' && ' cm'}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}
