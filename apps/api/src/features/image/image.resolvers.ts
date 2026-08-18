import type { GraphQLContext } from '../../graphql/context.js'
import { toGraphQLError } from '../../graphql/errors.js'
import {
  getImageDeliveryUrl,
  imageService,
  type PrepareImageUploadInput,
} from './image.service.js'

export const imageResolvers = {
  ImageAsset: {
    deliveryUrl: (asset: {
      cloudflareImageId: string
      deliveryUrl?: string | null
    }) => asset.deliveryUrl ?? getImageDeliveryUrl(asset.cloudflareImageId),
  },
  Mutation: {
    prepareImageUpload: async (
      _parent: unknown,
      { input }: { input: PrepareImageUploadInput },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return imageService.prepareUpload(viewer.id, input)
      } catch (error) {
        throw toGraphQLError(
          error,
          '이미지 업로드를 준비하지 못했습니다.',
          'IMAGE_UPLOAD_PREPARE_FAILED',
        )
      }
    },
    confirmImageUpload: async (
      _parent: unknown,
      { assetId }: { assetId: string },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return imageService.confirmUpload(viewer.id, assetId)
      } catch (error) {
        throw toGraphQLError(
          error,
          '이미지 업로드를 확인하지 못했습니다.',
          'IMAGE_UPLOAD_CONFIRM_FAILED',
        )
      }
    },
  },
}
