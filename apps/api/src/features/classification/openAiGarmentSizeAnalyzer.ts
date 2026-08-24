import type { ClothingCategory } from '@closet/types'
import { ServiceError } from '../../graphql/errors.js'
import { getOpenAiClassificationModel } from './openAiWardrobeClassifier.js'

export interface GarmentSizeChartRow {
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

interface OpenAiGarmentSizeAnalysis {
  rows: GarmentSizeChartRow[]
  notes: string[]
}

const measurementKeys = [
  'shoulderWidthCm',
  'chestWidthCm',
  'sleeveLengthCm',
  'totalLengthCm',
  'waistWidthCm',
  'hipWidthCm',
  'inseamCm',
  'thighWidthCm',
  'riseCm',
  'hemWidthCm',
] as const

function getOutputText(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null

  const response = payload as {
    output_text?: unknown
    output?: Array<{
      type?: unknown
      content?: Array<{ type?: unknown; text?: unknown }>
    }>
  }

  if (typeof response.output_text === 'string') return response.output_text

  for (const output of response.output ?? []) {
    if (output.type !== 'message') continue
    for (const content of output.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        return content.text
      }
    }
  }

  return null
}

function isNullableMeasurement(value: unknown) {
  return (
    value === null ||
    (typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0.1 &&
      value <= 300)
  )
}

function isGarmentSizeChartRow(value: unknown): value is GarmentSizeChartRow {
  if (!value || typeof value !== 'object') return false

  const row = value as Partial<GarmentSizeChartRow>
  return (
    typeof row.sizeLabel === 'string' &&
    row.sizeLabel.trim().length > 0 &&
    row.sizeLabel.trim().length <= 20 &&
    measurementKeys.every((key) => isNullableMeasurement(row[key]))
  )
}

function isOpenAiGarmentSizeAnalysis(
  value: unknown,
): value is OpenAiGarmentSizeAnalysis {
  if (!value || typeof value !== 'object') return false

  const analysis = value as Partial<OpenAiGarmentSizeAnalysis>
  return (
    Array.isArray(analysis.rows) &&
    analysis.rows.length <= 30 &&
    analysis.rows.every(isGarmentSizeChartRow) &&
    Array.isArray(analysis.notes) &&
    analysis.notes.length <= 10 &&
    analysis.notes.every(
      (note) => typeof note === 'string' && note.trim().length <= 160,
    )
  )
}

const nullableMeasurementSchema = {
  type: ['number', 'null'],
  minimum: 0.1,
  maximum: 300,
}

export async function analyzeGarmentSizeChartWithOpenAi(
  imageBuffer: Buffer,
  mimeType: string,
  category: ClothingCategory,
) {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new ServiceError(
      'AI 이미지 분석 설정을 확인해주세요.',
      'AI_CONFIGURATION_ERROR',
    )
  }

  const model = getOpenAiClassificationModel()
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: 'low' },
      input: [
        {
          role: 'system',
          content: [
            '당신은 한국 의류 쇼핑몰의 사이즈표 이미지를 읽는 데이터 분석가입니다.',
            '이미지에 실제로 보이는 표, 단위, 각주만 사용해 사이즈별 실측값을 추출하고 모든 값은 cm로 반환하세요.',
            '표의 열 이름을 먼저 정확히 읽은 뒤 열 하나를 의미가 같은 목표 필드 하나에만 대응하세요. 하나의 원본 열을 여러 목표 필드에 복사하면 안 됩니다.',
            '허벅지, 허벅지폭, 허벅지단면 열은 반드시 thighWidthCm에만 넣고 hipWidthCm에는 절대 넣지 마세요.',
            'hipWidthCm은 엉덩이, 엉덩이폭, 힙, 힙단면처럼 엉덩이 치수임이 명확한 열이 있을 때만 사용하세요. 표에 엉덩이 또는 힙 열이 없으면 hipWidthCm은 null입니다.',
            '밑위는 riseCm, 밑단은 hemWidthCm, 총장은 totalLengthCm에 대응하며 서로 대신할 수 없습니다.',
            '나그랑 또는 래글런처럼 어깨선이 없는 옷은 표에 어깨 치수가 별도로 표시되지 않았다면 shoulderWidthCm을 null로 두세요. 소매나 화장 치수로 어깨너비를 추정하면 안 됩니다.',
            '앱의 waistWidthCm, chestWidthCm, hipWidthCm, thighWidthCm, hemWidthCm은 옷을 평평하게 놓고 잰 한쪽 단면입니다.',
            '제품 실측표의 열 이름에 가슴둘레, 허리둘레, 엉덩이둘레처럼 둘레가 명시되어 있으면 그 열은 완성된 옷의 전체 둘레입니다. 같은 표에 기장, 어깨, 소매 등 제품 실측값이 함께 있는지 확인한 뒤 2로 나누어 해당 단면 필드에 넣으세요.',
            '열 이름이 가슴단면, 가슴폭, 허리단면, 허리폭, 엉덩이단면, 힙단면처럼 단면 또는 폭으로 명시되어 있으면 나누지 말고 그대로 사용하세요.',
            '각주나 측정법에 단면값의 X2 또는 둘레라고 적힌 경우에도 2로 나누어 단면으로 변환하세요.',
            '예를 들어 제품 실측표의 가슴둘레가 123이면 chestWidthCm은 61.5이고, 허리둘레가 85이면 waistWidthCm은 42.5입니다. 둘레값을 그대로 단면 필드에 반환하면 안 됩니다.',
            '둘레를 단면으로 변환했다면 어떤 원본 열과 값을 2로 나눴는지 notes에 남기세요.',
            '열 이름과 각주를 봐도 둘레인지 단면인지 불명확한 값은 추측하거나 변환하지 말고 null로 두세요.',
            '총장, 소매 길이, 밑위처럼 길이 자체인 항목은 명확할 때 그대로 사용하세요.',
            '이미지에 없는 항목과 의미가 애매한 항목은 반드시 null로 두세요.',
            '색상별 표, 신체 권장 치수, 모델 착용 정보는 옷의 실측값으로 사용하지 마세요.',
            '표의 실제 사이즈 행만 반환하고 헤더나 설명을 행으로 만들지 마세요.',
            '표를 읽을 수 없거나 매칭되는 실측 항목이 없어도 추측하지 말고 rows를 비우거나 모든 값을 null로 반환하세요.',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify({
                task: '옷장 사이즈 정보 자동 입력용 사이즈표 분석',
                category,
                targetFields: {
                  shoulderWidthCm: '어깨너비 단면',
                  chestWidthCm: '가슴 단면',
                  sleeveLengthCm: '소매 길이',
                  totalLengthCm: '총장',
                  waistWidthCm: '허리 단면',
                  hipWidthCm: '엉덩이 단면',
                  inseamCm: '인심',
                  thighWidthCm: '허벅지 단면',
                  riseCm: '밑위',
                  hemWidthCm: '밑단 단면',
                },
                mappingRules: {
                  thighWidthCm: ['허벅지', '허벅지폭', '허벅지단면'],
                  hipWidthCm: ['엉덩이', '엉덩이폭', '힙', '힙단면'],
                  chestWidthCm:
                    '가슴단면/가슴폭은 그대로 사용. 제품 실측표의 가슴둘레는 2로 나누고 notes에 변환 근거 기록',
                  waistWidthCm:
                    '허리단면/허리폭은 그대로 사용. 제품 실측표의 허리둘레는 2로 나누고 notes에 변환 근거 기록',
                  shoulderWidthCm:
                    '어깨 단면. 나그랑/래글런처럼 어깨선이 없고 별도 어깨 치수가 없으면 null',
                  doNotReuseSourceColumn: true,
                },
              }),
            },
            {
              type: 'input_image',
              image_url: `data:${mimeType};base64,${imageBuffer.toString('base64')}`,
              detail: 'high',
            },
          ],
        },
      ],
      max_output_tokens: 3200,
      text: {
        format: {
          type: 'json_schema',
          name: 'garment_size_chart_analysis',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['rows', 'notes'],
            properties: {
              rows: {
                type: 'array',
                maxItems: 30,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['sizeLabel', ...measurementKeys],
                  properties: {
                    sizeLabel: {
                      type: 'string',
                      minLength: 1,
                      maxLength: 20,
                    },
                    shoulderWidthCm: nullableMeasurementSchema,
                    chestWidthCm: nullableMeasurementSchema,
                    sleeveLengthCm: nullableMeasurementSchema,
                    totalLengthCm: nullableMeasurementSchema,
                    waistWidthCm: nullableMeasurementSchema,
                    hipWidthCm: nullableMeasurementSchema,
                    inseamCm: nullableMeasurementSchema,
                    thighWidthCm: nullableMeasurementSchema,
                    riseCm: nullableMeasurementSchema,
                    hemWidthCm: nullableMeasurementSchema,
                  },
                },
              },
              notes: {
                type: 'array',
                maxItems: 10,
                items: { type: 'string', maxLength: 160 },
              },
            },
          },
        },
      },
    }),
    signal: AbortSignal.timeout(45_000),
  })

  if (!response.ok) {
    throw new Error(`OpenAI garment size analysis failed with ${response.status}`)
  }

  const payload: unknown = await response.json()
  const outputText = getOutputText(payload)
  if (!outputText) {
    throw new Error('OpenAI garment size analysis output is empty')
  }

  const parsed: unknown = JSON.parse(outputText)
  if (!isOpenAiGarmentSizeAnalysis(parsed)) {
    throw new Error('OpenAI garment size analysis output is invalid')
  }

  return {
    rows: parsed.rows.map((row) => ({
      ...row,
      sizeLabel: row.sizeLabel.trim(),
    })),
    notes: parsed.notes.map((note) => note.trim()).filter(Boolean),
    model,
  }
}
