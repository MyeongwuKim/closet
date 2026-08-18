import { toGraphQLError } from '../../graphql/errors.js'
import {
  classificationService,
  type AnalyzeGarmentSizeChartInput,
  type ClassifyWardrobeImageInput,
} from './classification.service.js'

export const classificationResolvers = {
  Mutation: {
    classifyWardrobeImage: async (
      _parent: unknown,
      { input }: { input: ClassifyWardrobeImageInput },
    ) => {
      try {
        return await classificationService.classify(input)
      } catch (error) {
        throw toGraphQLError(
          error,
          '옷 이미지 판별에 실패했습니다. 잠시 후 다시 시도해주세요.',
          'CLASSIFICATION_FAILED',
        )
      }
    },
    analyzeGarmentSizeChart: async (
      _parent: unknown,
      { input }: { input: AnalyzeGarmentSizeChartInput },
    ) => {
      try {
        return await classificationService.analyzeSizeChart(input)
      } catch (error) {
        throw toGraphQLError(
          error,
          '사이즈표를 분석하지 못했습니다. 잠시 후 다시 시도해주세요.',
          'SIZE_CHART_ANALYSIS_FAILED',
        )
      }
    },
  },
}
