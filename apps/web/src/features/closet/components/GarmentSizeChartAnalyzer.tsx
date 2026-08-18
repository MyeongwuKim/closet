import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { ClothingCategory } from '@closet/types'
import { ImagePlus, LoaderCircle, Sparkles } from 'lucide-react'
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [applyMessage, setApplyMessage] = useState<string | null>(null)

  const fields = getGarmentMeasurementFields(category)
  const selectedRow = analysis?.rows[selectedRowIndex] ?? null
  const matchedFields = selectedRow
    ? fields.filter(({ key }) => selectedRow[key] !== null)
    : []

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
    setApplyMessage(null)

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

    const nextValue = { ...value }
    let appliedCount = 0

    if (!nextValue.sizeLabel.trim() && selectedRow.sizeLabel.trim()) {
      nextValue.sizeLabel = selectedRow.sizeLabel.trim()
      appliedCount += 1
    }

    fields.forEach(({ key }) => {
      const measurement = selectedRow[key]
      if (!nextValue[key].trim() && measurement !== null) {
        nextValue[key] = String(measurement)
        appliedCount += 1
      }
    })

    onChange(nextValue)
    setApplyMessage(
      appliedCount > 0
        ? `빈 칸 ${appliedCount}개를 채웠어요.`
        : '이미 입력된 값은 그대로 유지했어요.',
    )
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={handleFileChange}
        aria-label="사이즈표 이미지 선택"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={analysisMutation.isPending}
        className="absolute top-2 right-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-line bg-white px-3 text-xs font-bold hover:border-ink disabled:cursor-wait disabled:opacity-60"
      >
        {analysisMutation.isPending ? (
          <LoaderCircle className="animate-spin" size={17} />
        ) : (
          <ImagePlus size={17} />
        )}
        {analysisMutation.isPending
          ? '분석 중'
          : analysis
            ? '다시 분석'
            : '사진으로 입력'}
      </button>

      {errorMessage && (
        <p className="mt-4 text-xs leading-5 text-red-600" role="alert">
          {errorMessage}
        </p>
      )}

      {analysis && analysis.rows.length > 0 && (
        <div className="mt-4 rounded-xl border border-line bg-white p-3">
          <div className="flex items-center gap-1.5 text-xs font-black">
            <Sparkles size={14} /> 분석된 사이즈 선택
          </div>
          <div
            className="mt-2 flex gap-2 overflow-x-auto pb-1"
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
                  onClick={() => {
                    setSelectedRowIndex(index)
                    setApplyMessage(null)
                  }}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold ${
                    isSelected
                      ? 'border-ink bg-ink text-white'
                      : 'border-line bg-canvas text-muted hover:text-ink'
                  }`}
                  key={`${row.sizeLabel}-${index}`}
                >
                  {row.sizeLabel}
                </button>
              )
            })}
          </div>

          <div className="mt-3 rounded-xl bg-canvas p-3">
            {matchedFields.length > 0 ? (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                {matchedFields.map((field) => (
                  <div className="flex justify-between gap-2" key={field.key}>
                    <dt className="text-muted">{field.label}</dt>
                    <dd className="font-black">{selectedRow?.[field.key]}cm</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-xs leading-5 text-muted">
                이 사이즈에서 현재 카테고리에 맞는 실측값을 찾지 못했어요.
              </p>
            )}
          </div>

          {analysis.notes.length > 0 && (
            <div className="mt-2 space-y-1 text-[11px] leading-5 text-muted">
              {analysis.notes.map((note) => (
                <p key={note}>· {note}</p>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={applySelectedRow}
            disabled={matchedFields.length === 0}
            className="mt-3 w-full rounded-xl bg-ink px-3 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            선택한 사이즈 적용
          </button>
          <p className="mt-2 text-[11px] leading-5 text-muted">
            직접 입력한 값은 덮어쓰지 않고 빈 칸만 채워요.
          </p>
          {applyMessage && (
            <p className="mt-1 text-xs font-bold text-accent" role="status">
              {applyMessage}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
