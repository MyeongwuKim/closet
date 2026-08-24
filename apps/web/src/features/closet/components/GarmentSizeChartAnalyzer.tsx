import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { ClothingCategory } from '@closet/types'
import { createPortal } from 'react-dom'
import {
  Check,
  ChevronRight,
  ImagePlus,
  Info,
  LoaderCircle,
  Sparkles,
  X,
} from 'lucide-react'
import {
  useAnalyzeGarmentSizeChartMutation,
  type AnalyzedGarmentSizeRow,
  type GarmentSizeChartAnalysis,
} from '../api/analyzeGarmentSizeChart'
import {
  MAX_CLOTHING_IMAGE_SIZE,
  SUPPORTED_CLOTHING_IMAGE_TYPES,
} from '../constants'
import {
  getGarmentMeasurementFields,
  type GarmentSizeFormValue,
} from '../utils/garmentSize'

interface GarmentSizeChartAnalyzerProps {
  category: ClothingCategory
  value: GarmentSizeFormValue
  onChange: (value: GarmentSizeFormValue) => void
}

function normalizeSizeLabel(value: string) {
  return value.toLocaleLowerCase().replace(/[\s()[\]{}]/g, '')
}

function findInitialRowIndex(
  rows: AnalyzedGarmentSizeRow[],
  currentSizeLabel: string,
) {
  const normalizedCurrent = normalizeSizeLabel(currentSizeLabel)
  if (!normalizedCurrent) return 0

  const index = rows.findIndex((row) => {
    const normalizedRow = normalizeSizeLabel(row.sizeLabel)
    return (
      normalizedRow === normalizedCurrent ||
      normalizedRow.startsWith(normalizedCurrent) ||
      normalizedCurrent.startsWith(normalizedRow)
    )
  })
  return index >= 0 ? index : 0
}

export function GarmentSizeChartAnalyzer({
  category,
  value,
  onChange,
}: GarmentSizeChartAnalyzerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const analysisMutation = useAnalyzeGarmentSizeChartMutation()
  const [analysis, setAnalysis] = useState<GarmentSizeChartAnalysis | null>(
    null,
  )
  const [selectedRowIndex, setSelectedRowIndex] = useState(0)
  const [isResultOpen, setIsResultOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [appliedLabel, setAppliedLabel] = useState<string | null>(null)

  const fields = getGarmentMeasurementFields(category)
  const selectedRow = analysis?.rows[selectedRowIndex] ?? null
  const matchedFields = selectedRow
    ? fields.filter(({ key }) => selectedRow[key] !== null)
    : []

  useEffect(() => {
    if (!isResultOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      setIsResultOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isResultOpen])

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (
      !SUPPORTED_CLOTHING_IMAGE_TYPES.some((type) => type === file.type) ||
      file.size > MAX_CLOTHING_IMAGE_SIZE
    ) {
      setErrorMessage('10MB 이하의 JPEG, PNG, WEBP 이미지를 선택해주세요.')
      return
    }

    setAnalysis(null)
    setErrorMessage(null)
    setAppliedLabel(null)

    try {
      const nextAnalysis = await analysisMutation.mutateAsync({
        file,
        category,
      })
      setAnalysis(nextAnalysis)
      setSelectedRowIndex(
        findInitialRowIndex(nextAnalysis.rows, value.sizeLabel),
      )
      if (nextAnalysis.rows.length === 0) {
        setErrorMessage(
          '사이즈 행을 찾지 못했어요. 표가 선명하게 보이는 이미지를 다시 올려주세요.',
        )
      } else {
        setIsResultOpen(true)
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : '사이즈표를 분석하지 못했습니다.',
      )
    }
  }

  const applySelectedRow = () => {
    if (!selectedRow) return

    const nextValue = {
      ...value,
      sizeLabel: selectedRow.sizeLabel.trim(),
    }

    fields.forEach(({ key }) => {
      const measurement = selectedRow[key]
      if (measurement !== null) {
        nextValue[key] = String(measurement)
      }
    })

    onChange(nextValue)
    setAppliedLabel(`${selectedRow.sizeLabel.trim()} 값을 적용했어요.`)
    setIsResultOpen(false)
  }

  return (
    <div className="mt-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={handleFileChange}
        aria-label="사이즈표 이미지 선택"
      />

      {analysis && analysis.rows.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-surface p-3">
          <button
            type="button"
            onClick={() => setIsResultOpen(true)}
            aria-haspopup="dialog"
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-ink px-3 text-xs font-bold text-white"
          >
            <Sparkles size={16} /> 결과 보기
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={analysisMutation.isPending}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3 text-xs font-bold transition hover:border-ink disabled:cursor-wait disabled:opacity-60"
          >
            {analysisMutation.isPending ? (
              <LoaderCircle className="animate-spin" size={17} />
            ) : (
              <ImagePlus size={17} />
            )}
            {analysisMutation.isPending ? '분석 중...' : '다시 분석'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={analysisMutation.isPending}
          className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-ink disabled:cursor-wait disabled:opacity-60"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sage">
            {analysisMutation.isPending ? (
              <LoaderCircle className="animate-spin" size={19} />
            ) : (
              <ImagePlus size={19} />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black">
              {analysisMutation.isPending
                ? '사이즈표 분석 중...'
                : '사이즈표 사진 올리기'}
            </span>
            <span className="mt-1 block whitespace-nowrap text-xs leading-5 text-muted">
              {analysisMutation.isPending
                ? '사이즈와 치수를 찾고 있어요.'
                : 'AI가 치수를 자동으로 채워드려요.'}
            </span>
          </span>
          {!analysisMutation.isPending && (
            <ChevronRight className="shrink-0 text-muted" size={18} />
          )}
        </button>
      )}

      {errorMessage && (
        <p className="mt-3 text-xs leading-5 text-red-600" role="alert">
          {errorMessage}
        </p>
      )}
      {appliedLabel && (
        <p
          className="mt-3 flex items-center gap-1.5 text-xs font-bold text-accent"
          role="status"
        >
          <Check size={14} /> {appliedLabel}
        </p>
      )}

      {analysis &&
        analysis.rows.length > 0 &&
        isResultOpen &&
        createPortal(
          <div
            className="option-picker-backdrop fixed inset-0 z-[120] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setIsResultOpen(false)
            }}
          >
            <section
              className="option-picker-enter flex max-h-[86dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="analyzed-size-title"
            >
              <header className="flex shrink-0 items-start gap-3 border-b border-line px-5 py-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sage">
                  <Sparkles size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id="analyzed-size-title" className="text-base font-black">
                    분석된 사이즈 선택
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    내 사이즈를 고르면 분석값이 입력란에 바로 적용돼요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsResultOpen(false)}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-canvas"
                  aria-label="분석 결과 닫기"
                  autoFocus
                >
                  <X size={18} />
                </button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                <div
                  className="scrollbar-hidden flex gap-2 overflow-x-auto pb-1"
                  role="radiogroup"
                  aria-label="분석된 사이즈"
                >
                  {analysis.rows.map((row, index) => {
                    const isSelected = selectedRowIndex === index
                    return (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setSelectedRowIndex(index)}
                        className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
                          isSelected
                            ? 'border-ink bg-ink text-white'
                            : 'border-line bg-canvas text-muted hover:border-ink hover:text-ink'
                        }`}
                        key={`${row.sizeLabel}-${index}`}
                      >
                        {row.sizeLabel}
                      </button>
                    )
                  })}
                </div>

                <div className="mt-5 rounded-2xl bg-canvas p-4">
                  {matchedFields.length > 0 ? (
                    <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
                      {matchedFields.map((field) => (
                        <div
                          className="flex min-w-0 items-center justify-between gap-2"
                          key={field.key}
                        >
                          <dt className="truncate text-muted">{field.label}</dt>
                          <dd className="shrink-0 font-black">
                            {selectedRow?.[field.key]}cm
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-xs leading-5 text-muted">
                      이 사이즈에서 현재 카테고리에 맞는 실측값을 찾지
                      못했어요. 표기 사이즈만 적용할 수 있어요.
                    </p>
                  )}
                </div>

                <p className="mt-3 flex items-center gap-1.5 text-xs leading-5 text-muted">
                  <Info className="shrink-0" size={15} aria-hidden="true" />
                  AI 분석 결과는 실제 치수와 다를 수 있어요.
                </p>
              </div>

              <footer className="shrink-0 border-t border-line bg-canvas/70 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-4">
                <button
                  type="button"
                  onClick={applySelectedRow}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white"
                >
                  <Check size={17} /> {selectedRow?.sizeLabel} 적용
                </button>
              </footer>
            </section>
          </div>,
          document.body,
        )}
    </div>
  )
}
