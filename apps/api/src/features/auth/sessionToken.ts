/**
 * 용도:
 * 로그인 세션과 해당 세션에서 등록한 푸시 기기를 같은 해시로 연결한다.
 *
 * 동작 방식:
 * 원본 액세스 토큰 대신 SHA-256 해시만 저장하고 비교한다.
 */
import { createHash } from 'node:crypto'

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}
