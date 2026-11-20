/** S3 receives the bucket separately; a bucket suffix in its endpoint duplicates the object prefix. */
export function normalizeR2Endpoint(value, bucketName) {
  if (typeof bucketName !== 'string' || !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(bucketName) || bucketName.length < 3 || bucketName.length > 63) {
    throw new Error('R2_BUCKET_NAME에는 경로 없이 실제 버킷 이름만 입력해주세요.')
  }
  let endpoint
  try { endpoint = new URL(value) }
  catch { throw new Error('R2_ENDPOINT는 올바른 R2 S3 API 주소여야 합니다.') }
  if (endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.r2.cloudflarestorage.com') || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.port) {
    throw new Error('R2_ENDPOINT에는 HTTPS R2 S3 API 주소만 입력해주세요.')
  }
  const pathname = endpoint.pathname.replace(/\/+$/, '')
  if (pathname && pathname !== `/${bucketName}`) {
    throw new Error('R2_ENDPOINT의 경로를 제거해주세요. 버킷은 R2_BUCKET_NAME으로 따로 지정합니다.')
  }
  return endpoint.origin
}
