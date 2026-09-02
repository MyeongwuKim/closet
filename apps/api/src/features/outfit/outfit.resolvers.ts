import type { ClothingCategory, OutfitStyle, Season } from '@prisma/client'
import type { GraphQLContext } from '../../graphql/context.js'
import { toGraphQLError } from '../../graphql/errors.js'
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
        return await todayOutfitRecommendationService.recommend(viewer.id, input)
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
        return outfitRecommendationService.recommend(viewer.id, input)
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
  },
  Mutation: {
    generateOutfitPreview: async (
      _parent: unknown,
      {
        input,
      }: { input: { selectedItemIds: string[]; style?: string | null } },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return outfitPreviewService.generate(
          viewer.id,
          input.selectedItemIds,
          input.style,
        )
      } catch (error) {
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
