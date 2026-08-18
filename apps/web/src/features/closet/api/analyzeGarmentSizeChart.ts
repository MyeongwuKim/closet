import type { ClothingCategory } from '@closet/types'
import { useMutation } from '@tanstack/react-query'
import {
  GraphqlRequestError,
  graphqlRequest,
} from '../../../lib/graphql'

export interface AnalyzedGarmentSizeRow {
  sizeLabel: string
  shoulderWidthCm: number | null
  chestWidthCm: number | null
  sleeveLengthCm: number | null
  totalLengthCm: number | null
  waistWidthCm: number | null
  hipWidthCm: number | null
  inseamCm: number | null
  thighWidthCm: number | null
  riseCm: number | null
  hemWidthCm: number | null
}

export interface GarmentSizeChartAnalysis {
  rows: AnalyzedGarmentSizeRow[]
  notes: string[]
  model: string
}

export class GarmentSizeChartAnalysisError extends Error {
  readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'GarmentSizeChartAnalysisError'
    this.code = code
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('이미지 파일을 읽지 못했습니다.'))
    reader.readAsDataURL(file)
  })
}

export async function analyzeGarmentSizeChart({
  file,
  category,
}: {
  file: File
  category: ClothingCategory
}) {
  const imageBase64 = await readFileAsDataUrl(file)

  try {
    const payload = await graphqlRequest<
      { analyzeGarmentSizeChart: GarmentSizeChartAnalysis },
      {
        input: {
          imageBase64: string
          mimeType: string
          filename: string
          category: ClothingCategory
        }
      }
    >(
      `
        mutation AnalyzeGarmentSizeChart($input: AnalyzeGarmentSizeChartInput!) {
          analyzeGarmentSizeChart(input: $input) {
            model
            notes
            rows {
              sizeLabel
              shoulderWidthCm
              chestWidthCm
              sleeveLengthCm
              totalLengthCm
              waistWidthCm
              hipWidthCm
              inseamCm
              thighWidthCm
              riseCm
              hemWidthCm
            }
          }
        }
      `,
      {
        input: {
          imageBase64,
          mimeType: file.type,
          filename: file.name,
          category,
        },
      },
    )

    return payload.analyzeGarmentSizeChart
  } catch (error) {
    if (error instanceof GraphqlRequestError) {
      throw new GarmentSizeChartAnalysisError(error.message, error.code)
    }
    throw new GarmentSizeChartAnalysisError(
      error instanceof Error
        ? error.message
        : '사이즈표를 분석하지 못했습니다.',
    )
  }
}

export function useAnalyzeGarmentSizeChartMutation() {
  return useMutation({
    mutationKey: ['wardrobe', 'size-chart-analysis'],
    mutationFn: analyzeGarmentSizeChart,
  })
}
