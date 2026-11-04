import type { ClothingCategory } from '@prisma/client'
import type { GraphQLContext } from '../../graphql/context.js'
import { toGraphQLError } from '../../graphql/errors.js'
import { wardrobeRediscoveryService } from './wardrobe-rediscovery.service.js'
import {
  wardrobeService,
  type CreateWardrobeItemInput,
  type UpdateWardrobeItemInput,
} from './wardrobe.service.js'

const isoDate = (value: Date | null | undefined) => value?.toISOString() ?? null

export const wardrobeResolvers = {
  WardrobeItem: {
    additionalCategories: (item: {
      additionalCategories?: ClothingCategory[] | null
    }) => item.additionalCategories ?? [],
    tags: (item: { tags?: string[] | null }) => item.tags ?? [],
    createdAt: (item: { createdAt: Date }) => item.createdAt.toISOString(),
    updatedAt: (item: { updatedAt: Date }) => item.updatedAt.toISOString(),
    lastWornAt: (item: { lastWornAt?: Date | null }) => isoDate(item.lastWornAt),
    archivedAt: (item: { archivedAt?: Date | null }) => isoDate(item.archivedAt),
  },
  Query: {
    /** 로그인 계정의 전체 옷장에서 오늘의 하이라이트를 조회한다. */
    wardrobeRediscovery: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      try {
        const viewer = await context.getViewer()
        return await wardrobeRediscoveryService.get(viewer.id)
      } catch (error) {
        throw toGraphQLError(error, '잊고 있던 옷을 불러오지 못했습니다.', 'WARDROBE_REDISCOVERY_FAILED')
      }
    },
    wardrobeBrandOptions: async (
      _parent: unknown,
      _args: Record<string, never>,
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return wardrobeService.listBrands(viewer.id)
      } catch (error) {
        throw toGraphQLError(
          error,
          '브랜드 목록을 불러오지 못했습니다.',
          'WARDROBE_BRAND_OPTIONS_FAILED',
        )
      }
    },
    wardrobeItems: async (
      _parent: unknown,
      args: { category?: ClothingCategory; subcategory?: string },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return wardrobeService.list(viewer.id, args)
      } catch (error) {
        throw toGraphQLError(error, '옷장을 불러오지 못했습니다.', 'WARDROBE_LOAD_FAILED')
      }
    },
    wardrobeItem: async (
      _parent: unknown,
      { id }: { id: string },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return wardrobeService.get(viewer.id, id)
      } catch (error) {
        throw toGraphQLError(error, '옷을 불러오지 못했습니다.', 'WARDROBE_ITEM_LOAD_FAILED')
      }
    },
  },
  Mutation: {
    /** 실제 화면에 보인 오늘의 하이라이트만 현재 계정의 노출 이력에 남긴다. */
    markWardrobeRediscoverySeen: async (
      _parent: unknown, { day, itemIds }: { day: string; itemIds: string[] }, context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return await wardrobeRediscoveryService.markSeen(viewer.id, day, itemIds)
      } catch (error) {
        throw toGraphQLError(error, '하이라이트 확인을 저장하지 못했습니다.', 'WARDROBE_REDISCOVERY_SEEN_FAILED')
      }
    },
    deleteWardrobeBrand: async (
      _parent: unknown,
      { brandName }: { brandName: string },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return wardrobeService.deleteBrand(viewer.id, brandName)
      } catch (error) {
        throw toGraphQLError(error, '브랜드를 삭제하지 못했습니다.', 'WARDROBE_BRAND_DELETE_FAILED')
      }
    },
    createWardrobeItem: async (
      _parent: unknown,
      { input }: { input: CreateWardrobeItemInput },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return wardrobeService.create(viewer.id, input)
      } catch (error) {
        throw toGraphQLError(error, '옷을 저장하지 못했습니다.', 'WARDROBE_CREATE_FAILED')
      }
    },
    updateWardrobeItem: async (
      _parent: unknown,
      { id, input }: { id: string; input: UpdateWardrobeItemInput },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return wardrobeService.update(viewer.id, id, input)
      } catch (error) {
        throw toGraphQLError(error, '옷 정보를 수정하지 못했습니다.', 'WARDROBE_UPDATE_FAILED')
      }
    },
    archiveWardrobeItem: async (
      _parent: unknown,
      { id }: { id: string },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return wardrobeService.archive(viewer.id, id)
      } catch (error) {
        throw toGraphQLError(error, '옷을 보관 처리하지 못했습니다.', 'WARDROBE_ARCHIVE_FAILED')
      }
    },
  },
}
