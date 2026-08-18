import type { ViewerRecord } from '../features/user/user.repository.js'
import { authService } from '../features/auth/auth.service.js'

export interface GraphQLContext {
  accessToken?: string
  getViewer: () => Promise<ViewerRecord>
}

function readBearerToken(authorization?: string) {
  if (!authorization?.startsWith('Bearer ')) return undefined
  return authorization.slice('Bearer '.length).trim() || undefined
}

export function createGraphQLContext(authorization?: string): GraphQLContext {
  const accessToken = readBearerToken(authorization)
  let viewerPromise: Promise<ViewerRecord> | undefined

  return {
    accessToken,
    getViewer: () => {
      viewerPromise ??= authService.getViewer(accessToken)
      return viewerPromise
    },
  }
}
