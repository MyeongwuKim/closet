import { ServiceError } from '../../graphql/errors.js'

interface CloudflareEnvelope<T> {
  success: boolean
  result: T | null
  errors?: Array<{ code: number; message: string }>
}

interface DirectUploadResult {
  id: string
  uploadURL: string
}

interface CloudflareImageDetails {
  id: string
  filename?: string
  uploaded?: string
  variants?: string[]
}

export interface CloudflareImageListPage {
  /** 원격 메타데이터는 정리 서비스에서 삭제 조건을 검증하기 전까지 신뢰하지 않는다. */
  images: unknown[]
  continuationToken?: string
}

async function assertCloudflareSuccess(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | CloudflareEnvelope<unknown>
    | null

  if (!response.ok || !payload?.success) {
    const message =
      payload?.errors?.map((error) => error.message).join(', ') ||
      `Cloudflare Images 요청 실패 (${response.status})`
    throw new ServiceError(message, 'CLOUDFLARE_REQUEST_FAILED')
  }
}

function getCloudflareConfig() {
  const accountId = process.env.CF_ACCOUNT
  const apiToken = process.env.CF_TOKEN

  if (!accountId || !apiToken) {
    throw new ServiceError(
      'Cloudflare Images 환경 변수가 설정되지 않았습니다.',
      'CLOUDFLARE_NOT_CONFIGURED',
    )
  }

  return { accountId, apiToken }
}

async function readCloudflareResponse<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | CloudflareEnvelope<T>
    | null

  if (!response.ok || !payload?.success || !payload.result) {
    const message =
      payload?.errors?.map((error) => error.message).join(', ') ||
      `Cloudflare Images 요청 실패 (${response.status})`
    throw new ServiceError(message, 'CLOUDFLARE_REQUEST_FAILED')
  }

  return payload.result
}

export const cloudflareImagesClient = {
  /** 오래된 업로드부터 최대 1,000개를 읽는다. 이어지는 페이지 번호와 응답 구조를 검증하며 업로드·삭제는 수행하지 않는다. */
  async listImages(continuationToken?: string): Promise<CloudflareImageListPage> {
    if (continuationToken !== undefined && (typeof continuationToken !== 'string' || !continuationToken || continuationToken.length > 32)) {
      throw new ServiceError('Cloudflare Images 목록 페이지 번호가 올바르지 않습니다.', 'CLOUDFLARE_INVALID_PAGE')
    }
    const { accountId, apiToken } = getCloudflareConfig()
    const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v2`)
    url.searchParams.set('per_page', '1000')
    url.searchParams.set('sort_order', 'asc')
    if (continuationToken) url.searchParams.set('continuation_token', continuationToken)
    const response = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${apiToken}` }, signal: AbortSignal.timeout(15_000) })
    const result = await readCloudflareResponse<unknown>(response)
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new ServiceError('Cloudflare Images 목록 응답을 확인할 수 없습니다.', 'CLOUDFLARE_INVALID_PAGE')
    }
    const page = result as { images?: unknown; continuation_token?: unknown }
    if (!Array.isArray(page.images) || page.images.length > 1000 || (page.continuation_token !== undefined && (typeof page.continuation_token !== 'string' || page.continuation_token.length > 32))) {
      throw new ServiceError('Cloudflare Images 목록 응답을 확인할 수 없습니다.', 'CLOUDFLARE_INVALID_PAGE')
    }
    return { images: page.images, ...(page.continuation_token ? { continuationToken: page.continuation_token as string } : {}) }
  },

  async uploadImage(input: {
    userId: string
    kind: string
    bytes: Uint8Array
    mimeType: string
    storageFilename: string
    metadata?: Record<string, string>
  }) {
    const { accountId, apiToken } = getCloudflareConfig()
    const form = new FormData()
    form.set(
      'file',
      new Blob([input.bytes], { type: input.mimeType }),
      input.storageFilename,
    )
    form.set('requireSignedURLs', 'false')
    form.set(
      'metadata',
      JSON.stringify({
        userId: input.userId,
        kind: input.kind,
        storageFilename: input.storageFilename,
        ...input.metadata,
      }),
    )

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}` },
        body: form,
        signal: AbortSignal.timeout(30_000),
      },
    )

    return readCloudflareResponse<CloudflareImageDetails>(response)
  },

  async createDirectUpload(input: {
    userId: string
    kind: string
    originalFilename?: string
    storageFilename: string
  }) {
    const { accountId, apiToken } = getCloudflareConfig()
    const form = new FormData()
    form.set('requireSignedURLs', 'false')
    form.set(
      'metadata',
      JSON.stringify({
        userId: input.userId,
        kind: input.kind,
        originalFilename: input.originalFilename,
        storageFilename: input.storageFilename,
      }),
    )

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v2/direct_upload`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}` },
        body: form,
        signal: AbortSignal.timeout(30_000),
      },
    )

    return readCloudflareResponse<DirectUploadResult>(response)
  },

  async getImageDetails(cloudflareImageId: string) {
    const { accountId, apiToken } = getCloudflareConfig()
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${encodeURIComponent(cloudflareImageId)}`,
      {
        headers: { Authorization: `Bearer ${apiToken}` },
        signal: AbortSignal.timeout(15_000),
      },
    )

    return readCloudflareResponse<CloudflareImageDetails>(response)
  },

  async deleteImage(cloudflareImageId: string) {
    const { accountId, apiToken } = getCloudflareConfig()
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${encodeURIComponent(cloudflareImageId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiToken}` },
        signal: AbortSignal.timeout(15_000),
      },
    )

    if (response.status === 404) return
    await assertCloudflareSuccess(response)
  },
}
