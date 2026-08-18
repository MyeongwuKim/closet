import { GraphQLError } from 'graphql'

export class ServiceError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = 'ServiceError'
  }
}

export function toGraphQLError(
  error: unknown,
  fallbackMessage: string,
  fallbackCode: string,
) {
  if (error instanceof GraphQLError) return error

  if (error instanceof ServiceError) {
    return new GraphQLError(error.message, {
      extensions: { code: error.code },
    })
  }

  return new GraphQLError(fallbackMessage, {
    extensions: {
      code: fallbackCode,
      cause: error instanceof Error ? error.message : 'Unknown error',
    },
  })
}
