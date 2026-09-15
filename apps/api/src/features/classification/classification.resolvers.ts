/**
 * 용도:
 * 옷 이미지·사이즈표 분석 요청을 GraphQL에 연결한다.
 *
 * 요청 흐름:
 * 로그인 사용자의 옷 분석이 완료되면 푸시 알림을 보내고,
 * 알림 실패와 관계없이 분석 결과를 반환한다.
 */
import type { GraphQLContext } from '../../graphql/context.js'
import { toGraphQLError } from '../../graphql/errors.js'
import { notifyCompletion } from '../push/push.service.js'
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
      context: GraphQLContext,
    ) => {
      try {
        const viewer = context.accessToken ? await context.getViewer() : null
        const classification = await classificationService.classify(input)
        if (viewer) notifyCompletion(viewer.id, 'wardrobe-classification')
        return classification
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
