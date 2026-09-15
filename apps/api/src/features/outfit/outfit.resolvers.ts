/**
 * 용도:
 * 코디 조회·저장과 AI 추천·이미지 생성 요청을 GraphQL에 연결한다.
 *
 * 요청 흐름:
 * 로그인 계정의 작업이 완료되면 등록된 기기에 완료 알림을 보내되,
 * 알림 전송 실패가 추천 결과에는 영향을 주지 않도록 분리한다.
 */
import type { ClothingCategory, OutfitStyle, Season } from '@prisma/client'
import type { GraphQLContext } from '../../graphql/context.js'
import { toGraphQLError } from '../../graphql/errors.js'
import { imageService } from '../image/image.service.js'
import { notifyCompletion, notifyFailure } from '../push/push.service.js'
import {
  outfitService,
  type CreateOutfitInput,
  type UpdateOutfitInput,
} from './outfit.service.js'
import { outfitRecommendationService } from './outfit-recommendation.service.js'
import { outfitPreviewService } from './outfit-preview.service.js'
import { todayOutfitRecommendationService } from './today-outfit-recommendation.service.js'
import type { WeatherSnapshot } from '../weather/weather.service.js'

export const outfitResolvers = {
  Outfit: {
    plannerOnly: (outfit: { plannerOnly?: boolean | null }) =>
      outfit.plannerOnly ?? false,
    createdAt: (outfit: { createdAt: Date }) => outfit.createdAt.toISOString(),
    updatedAt: (outfit: { updatedAt: Date }) => outfit.updatedAt.toISOString(),
  },
  OutfitGeneration: {
    requestedAt: (generation: { requestedAt: Date }) =>
      generation.requestedAt.toISOString(),
    completedAt: (generation: { completedAt?: Date | null }) =>
      generation.completedAt?.toISOString() ?? null,
  },
  Query: {
    todayOutfitRecommendation: async (
      _parent: unknown,
      {
        input,
      }: {
        input: {
          date: string
          season: Season
          baseItemId?: string | null
          style?: OutfitStyle | null
          variation?: number | null
          excludedOuterItemIds?: string[] | null
          weather?: WeatherSnapshot | null
        }
      },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        const recommendation = await todayOutfitRecommendationService.recommend(viewer.id, input)
        if (recommendation.ready) {
          notifyCompletion(viewer.id, 'today-outfit-recommendation')
        }
        return recommendation
      } catch (error) {
        throw toGraphQLError(
          error,
          '오늘의 코디를 불러오지 못했습니다.',
          'TODAY_OUTFIT_RECOMMENDATION_FAILED',
        )
      }
    },
    outfitRecommendation: async (
      _parent: unknown,
      {
        input,
      }: {
        input: {
          selectedItemIds: string[]
          targetCategory: ClothingCategory
        }
      },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        const recommendation = await outfitRecommendationService.recommend(viewer.id, input)
        notifyCompletion(viewer.id, 'outfit-recommendation')
        return recommendation
      } catch (error) {
        throw toGraphQLError(
          error,
          '코디 추천을 불러오지 못했습니다.',
          'OUTFIT_RECOMMENDATION_FAILED',
        )
      }
    },
    outfits: async (
      _parent: unknown,
      args: { style?: string; wardrobeItemIds?: string[] },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return outfitService.list(viewer.id, args)
      } catch (error) {
        throw toGraphQLError(error, '코디북을 불러오지 못했습니다.', 'OUTFIT_LOAD_FAILED')
      }
    },
    outfit: async (
      _parent: unknown,
      { id }: { id: string },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return outfitService.get(viewer.id, id)
      } catch (error) {
        throw toGraphQLError(error, '코디를 불러오지 못했습니다.', 'OUTFIT_LOAD_FAILED')
      }
    },
    outfitPreviewAsset: async (
      _parent: unknown,
      { id }: { id: string },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return await imageService.getGeneratedImage(viewer.id, id)
      } catch (error) {
        throw toGraphQLError(
          error,
          'AI 코디 이미지를 불러오지 못했습니다.',
          'OUTFIT_PREVIEW_NOT_FOUND',
        )
      }
    },
  },
  Mutation: {
    generateOutfitPreview: async (
      _parent: unknown,
      {
        input,
      }: { input: { selectedItemIds: string[]; style?: string | null } },
      context: GraphQLContext,
    ) => {
      let viewerId: string | null = null
      try {
        const viewer = await context.getViewer()
        viewerId = viewer.id
        const preview = await outfitPreviewService.generate(
          viewer.id,
          input.selectedItemIds,
          input.style,
        )
        const imageAsset = await imageService.storeGeneratedImage(viewer.id, {
          ...preview,
          temporary: true,
          metadata: {
            purpose: 'outfitPreview',
            selectedItemIds: input.selectedItemIds,
            ...(input.style ? { style: input.style } : {}),
          },
        })
        const storedPreview = await imageService.getGeneratedImage(
          viewer.id,
          imageAsset.id,
        )
        const searchParams = new URLSearchParams({
          items: input.selectedItemIds.join(','),
          from: '/lookbook',
          previewAssetId: storedPreview.assetId,
          preview: 'open',
        })
        if (input.style) searchParams.set('style', input.style)

        notifyCompletion(viewer.id, 'outfit-preview', {
          path: `/lookbook/new?${searchParams.toString()}`,
          previewAssetId: storedPreview.assetId,
        })
        return { ...preview, ...storedPreview }
      } catch (error) {
        if (viewerId) {
          const searchParams = new URLSearchParams({
            items: input.selectedItemIds.join(','),
            from: '/lookbook',
            preview: 'failed',
          })
          if (input.style) searchParams.set('style', input.style)
          notifyFailure(viewerId, 'outfit-preview', {
            path: `/lookbook/new?${searchParams.toString()}`,
          })
        }
        throw toGraphQLError(
          error,
          'AI 룩 미리보기를 만들지 못했습니다.',
          'OUTFIT_PREVIEW_GENERATION_FAILED',
        )
      }
    },
    createOutfit: async (
      _parent: unknown,
      { input }: { input: CreateOutfitInput },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return outfitService.create(viewer.id, input)
      } catch (error) {
        throw toGraphQLError(error, '코디를 저장하지 못했습니다.', 'OUTFIT_CREATE_FAILED')
      }
    },
    updateOutfit: async (
      _parent: unknown,
      { id, input }: { id: string; input: UpdateOutfitInput },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return outfitService.update(viewer.id, id, input)
      } catch (error) {
        throw toGraphQLError(error, '코디를 수정하지 못했습니다.', 'OUTFIT_UPDATE_FAILED')
      }
    },
    deleteOutfit: async (
      _parent: unknown,
      { id }: { id: string },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        await outfitService.remove(viewer.id, id)
        return true
      } catch (error) {
        throw toGraphQLError(error, '코디를 삭제하지 못했습니다.', 'OUTFIT_DELETE_FAILED')
      }
    },
  },
}
