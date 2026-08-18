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
      },
    )

    await assertCloudflareSuccess(response)
  },
}
