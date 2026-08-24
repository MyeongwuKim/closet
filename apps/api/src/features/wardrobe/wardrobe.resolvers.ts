import type { ClothingCategory } from '@prisma/client'
import type { GraphQLContext } from '../../graphql/context.js'
import { toGraphQLError } from '../../graphql/errors.js'
import {
  wardrobeService,
  type CreateWardrobeItemInput,
} from './wardrobe.service.js'
import type { UpdateWardrobeItemData } from './wardrobe.repository.js'

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
  },
  Query: {
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
      { id, input }: { id: string; input: UpdateWardrobeItemData },
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
