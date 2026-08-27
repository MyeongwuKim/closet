import type { ClothingCategory } from '@prisma/client'
import type { GraphQLContext } from '../../graphql/context.js'
import { toGraphQLError } from '../../graphql/errors.js'
import { catalogService, type WardrobePageInput, type OutfitPageInput } from './catalog.service.js'
import { statisticsService } from './statistics.service.js'

async function readCatalog<T>(context: GraphQLContext, read: (userId: string) => Promise<T>) {
  try {
    const viewer = await context.getViewer()
    return await read(viewer.id)
  } catch (error) {
    throw toGraphQLError(error, '옷장 정보를 불러오지 못했습니다.', 'CATALOG_LOAD_FAILED')
  }
}

export const catalogResolvers = {
  Query: {
    wardrobePage: (_: unknown, { input }: { input?: WardrobePageInput | null }, context: GraphQLContext) =>
      readCatalog(context, (userId) => catalogService.wardrobePage(userId, input ?? {})),
    outfitPage: (_: unknown, { input }: { input?: OutfitPageInput | null }, context: GraphQLContext) =>
      readCatalog(context, (userId) => catalogService.outfitPage(userId, input ?? {})),
    wardrobeFilterOptions: (_: unknown, args: { category?: ClothingCategory; subcategory?: string }, context: GraphQLContext) =>
      readCatalog(context, (userId) => catalogService.wardrobeFilters(userId, args.category, args.subcategory)),
    outfitFilterOptions: (_: unknown, _args: unknown, context: GraphQLContext) =>
      readCatalog(context, (userId) => catalogService.outfitFilters(userId)),
    wardrobeStatistics: (_: unknown, _args: unknown, context: GraphQLContext) =>
      readCatalog(context, (userId) => statisticsService.get(userId)),
  },
}
