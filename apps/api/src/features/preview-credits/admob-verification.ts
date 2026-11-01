import { createPublicKey, verify } from 'node:crypto'
import { ServiceError } from '../../graphql/errors.js'

type SigningKey = { keyId: number; pem: string }
let cachedKeys: { until: number; keys: SigningKey[] } | null = null
let fetching: Promise<SigningKey[]> | null = null

/** Google 고정 주소의 공개키만 읽어 6시간 재사용한다. 동시 콜백은 하나의 갱신 요청을 공유한다. */
async function getSigningKeys() {
  if (cachedKeys && cachedKeys.until > Date.now()) return cachedKeys.keys
  if (!fetching) fetching = (async () => {
    const response = await fetch('https://www.gstatic.com/admob/reward/verifier-keys.json', { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) throw new Error('광고 검증 공개키 조회 실패')
    const data = await response.json() as { keys?: SigningKey[] }
    const keys = data.keys?.filter((key) => Number.isSafeInteger(key.keyId) && typeof key.pem === 'string')
    if (!keys?.length) throw new Error('광고 검증 공개키 없음')
    cachedKeys = { keys, until: Date.now() + 6 * 60 * 60_000 }
    return keys
  })().finally(() => { fetching = null })
  return fetching
}

/**
 * URL의 원래 쿼리 바이트와 Google ECDSA 서명을 확인한다. 순서 변경·중복 필드·미래/오래된 이벤트를 거절한다.
 * 검증 후에도 호출자가 발급 세션·광고 단위·거래 번호를 확인해야 하며 이 함수는 생성권을 지급하지 않는다.
 */
export async function verifyAdmobReward(rawUrl: string, keys: () => Promise<SigningKey[]> = getSigningKeys, now = Date.now()) {
  const invalid = () => new ServiceError('광고 보상을 검증하지 못했어요.', 'INVALID_AD_REWARD')
  const query = rawUrl.split('?')[1]
  if (!query || query.length > 8000) throw invalid()
  const signatureAt = query.indexOf('&signature=')
  if (signatureAt < 1 || !/^signature=[^&]+&key_id=\d+$/.test(query.slice(signatureAt + 1))) throw invalid()
  const params = new URLSearchParams(query)
  if (new Set(params.keys()).size !== [...params.keys()].length) throw invalid()
  const timestamp = Number(params.get('timestamp'))
  const sessionId = params.get('custom_data') ?? ''
  const transactionId = params.get('transaction_id') ?? ''
  if (!Number.isSafeInteger(timestamp) || timestamp < now - 86_400_000 || timestamp > now + 5 * 60_000 ||
    !/^[\w-]{8,100}$/.test(sessionId) || params.get('user_id') !== sessionId || !/^[\w-]{1,200}$/.test(transactionId) || Number(params.get('reward_amount')) !== 1) throw invalid()
  const keyId = Number(params.get('key_id'))
  let publicKeys = await keys()
  if (!publicKeys.some((key) => key.keyId === keyId) && keys === getSigningKeys) {
    cachedKeys = null
    publicKeys = await keys()
  }
  const key = publicKeys.find((key) => key.keyId === keyId)
  if (!key) throw invalid()
  let valid = false
  try { valid = verify('sha256', Buffer.from(query.slice(0, signatureAt)), createPublicKey(key.pem), Buffer.from(params.get('signature')!, 'base64url')) } catch { throw invalid() }
  if (!valid) throw invalid()
  return { sessionId, transactionId, adUnitId: params.get('ad_unit') ?? '', eventAt: new Date(timestamp), mode: 'production' as const }
}
