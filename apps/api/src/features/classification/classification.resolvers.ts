import { aiExecutor } from '../../lib/ai/ai-execution.js'
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
    /** 로그인한 사용자의 사진으로 컷아웃 PNG를 생성해 수동 옷 등록 후보에 전달한다. */
    removeWardrobeImageBackground: async (
      _parent: unknown,
      { input }: { input: ClassifyWardrobeImageInput },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return await aiExecutor.run(viewer.id, 'cutout', { image: input.imageBase64, mimeType: input.mimeType }, () => classificationService.createCutout(input))
      } catch (error) {
        throw toGraphQLError(error, '사진 배경을 제거하지 못했습니다.', 'BACKGROUND_REMOVAL_FAILED')
      }
    },
    classifyWardrobeImage: async (
      _parent: unknown,
      { input }: { input: ClassifyWardrobeImageInput },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return await aiExecutor.run(viewer.id, 'classification', {
          image: input.imageBase64, mimeType: input.mimeType,
        }, async () => {
          const classification = await classificationService.classify(input)
          notifyCompletion(viewer.id, 'wardrobe-classification')
          return classification
        }, 2 * 60_000)
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
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return await aiExecutor.run(viewer.id, 'size-chart', input, () => classificationService.analyzeSizeChart(input), 5 * 60_000)
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
