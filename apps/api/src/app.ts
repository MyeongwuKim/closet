import { ApolloServer } from '@apollo/server'
import fastifyApollo, {
  fastifyApolloDrainPlugin,
} from '@as-integrations/fastify'
import cors from '@fastify/cors'
import Fastify from 'fastify'
import { createGraphQLContext, type GraphQLContext } from './graphql/context.js'
import { resolvers } from './graphql/resolvers.js'
import { typeDefs } from './graphql/schema.js'

const GRAPHQL_BODY_LIMIT = 16 * 1024 * 1024

export async function buildApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: GRAPHQL_BODY_LIMIT,
  })

  await app.register(cors, {
    origin: [
      ...(process.env.WEB_ORIGIN ?? 'http://localhost:5173')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
      // The bundled WebView uses this base URL in both development and release.
      'https://closet.native',
    ],
  })

  app.get('/health', async () => ({
    service: 'closet-api',
    status: 'ok',
    graphql: '/graphql',
  }))

  const apollo = new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,
    csrfPrevention: true,
    plugins: [fastifyApolloDrainPlugin(app)],
  })

  await apollo.start()
  await app.register(fastifyApollo(apollo), {
    path: '/graphql',
    method: ['POST', 'OPTIONS'],
    context: async (request) =>
      createGraphQLContext(request.headers.authorization),
  })

  return app
}
