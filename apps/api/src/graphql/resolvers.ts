import { authResolvers } from '../features/auth/auth.resolvers.js'
import { catalogResolvers } from '../features/catalog/catalog.resolvers.js'
import { classificationResolvers } from '../features/classification/classification.resolvers.js'
import { getOpenAiClassificationModel } from '../features/classification/openAiWardrobeClassifier.js'
import { imageResolvers } from '../features/image/image.resolvers.js'
import { outfitResolvers } from '../features/outfit/outfit.resolvers.js'
import { plannerResolvers } from '../features/planner/planner.resolvers.js'
import { userResolvers } from '../features/user/user.resolvers.js'
import { wardrobeResolvers } from '../features/wardrobe/wardrobe.resolvers.js'
import { weatherResolvers } from '../features/weather/weather.resolvers.js'

export const resolvers = {
  Query: {
    health: () => ({
      service: 'closet-api',
      status: 'ok',
      classifier: getOpenAiClassificationModel(),
    }),
    ...userResolvers.Query,
    ...wardrobeResolvers.Query,
    ...outfitResolvers.Query,
    ...plannerResolvers.Query,
    ...catalogResolvers.Query,
    ...weatherResolvers.Query,
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...userResolvers.Mutation,
    ...imageResolvers.Mutation,
    ...wardrobeResolvers.Mutation,
    ...outfitResolvers.Mutation,
    ...plannerResolvers.Mutation,
    ...classificationResolvers.Mutation,
  },
  ImageAsset: imageResolvers.ImageAsset,
  WardrobeItem: wardrobeResolvers.WardrobeItem,
  Outfit: outfitResolvers.Outfit,
  OutfitGeneration: outfitResolvers.OutfitGeneration,
  PlannerWeek: plannerResolvers.PlannerWeek,
  PlannerEntry: plannerResolvers.PlannerEntry,
  OutfitWearRecord: plannerResolvers.OutfitWearRecord,
}
