# 브리지 변경의 조건별 확인

## 전송과 요청 정리

- 브리지 응답의 `ok`와 카메라·위치 결과의 `status`는 다른 층이다. 권한 거절·사용자 취소 같은 정상적인 상태 응답을 전송 실패와 섞지 않는다.
- GraphQL은 앱 환경의 고정 API와 네이티브 세션을 사용한다. 웹 메시지에서 임의 URL·인증 헤더를 받아 전송하는 경로로 바꾸지 않는다. HTTP 실패·GraphQL 오류도 웹의 기존 처리로 전달한다.
- 이미 취소된 요청은 전송하지 않고, 동일 ID를 중복 실행하지 않는다. 웹 취소와 시간 초과가 네이티브 AbortController에 전달되고 양쪽 대기 상태가 종료되는지 확인한다.
- 요청 종류별 시간 제한을 유지한다. 광고·권한 팝업·촬영을 일반 조회의 짧은 시간 제한으로 통일하지 않는다. 앱에서 `AbortSignal.timeout`이 없더라도 동작하는 현재 AbortController 방식을 따른다.
- 응답은 `postNativeBridgeResponse`의 JSON 직렬화를 사용한다. ID·사용자 데이터를 JavaScript 문자열에 직접 이어 붙이지 않는다.

근거: [injectedScript.ts](../../../../apps/native/src/webview/bridge/injectedScript.ts), [graphqlBridge.ts](../../../../apps/native/src/webview/bridge/graphqlBridge.ts), [responses.ts](../../../../apps/native/src/webview/bridge/responses.ts). 관련 검사: [graphql-bridge.test.mjs](../../../../apps/native/scripts/graphql-bridge.test.mjs).

## 촬영과 위치 결과

- 촬영 결과는 JPEG로 정규화한 base64·MIME·크기·용량 계약을 유지한다. 현재 촬영본은 앱 캐시에 있으며 사진 앨범에 자동 저장하지 않는다.
- 위치는 서비스 사용 가능 여부와 권한을 확인한 뒤 허용된 최신 캐시 또는 새 좌표를 사용한다. 정확도·시각·거절 후 재요청 가능 여부를 웹에 전달하는 계약을 유지한다.
- 정상 촬영·좌표 응답 외에 취소, 권한 거절, 위치 서비스 중단, 잘못된 기기 응답을 각각 확인한다.

근거: [cameraBridge.ts](../../../../apps/native/src/webview/bridge/cameraBridge.ts), [cameraCapture.ts](../../../../apps/native/src/webview/bridge/cameraCapture.ts), [locationBridge.ts](../../../../apps/native/src/webview/bridge/locationBridge.ts), [locationCapture.ts](../../../../apps/native/src/webview/bridge/locationCapture.ts).

## 세션과 권한

- 웹 토큰과 WebView에 주입하는 토큰 키, 네이티브 SecureStore의 동기화 경로를 함께 확인한다. 세션 저장 callback을 기다린 뒤 응답하는 순서를 유지한다.
- 권한 상태 조회와 시스템 권한 요청을 구분한다. 앱 정보 조회만으로 권한 팝업을 열지 않는다. `limited`·`undetermined`·`unavailable`을 단순 허용·거절로 뭉개지 않는다.
- 알림 권한이 허용되거나 제한적으로 허용되고 로그인한 경우의 푸시 기기 등록을 유지한다. 최초 권한 안내는 설치 단위 완료 여부와 알림 → 위치 순서를 사용한다.
- 기능 노출을 바꾸면 `appInfoBridge.ts`의 capabilities와 웹이 호출 가능한 실제 기능이 일치하는지 확인한다.

근거: [authSessionBridge.ts](../../../../apps/native/src/webview/bridge/authSessionBridge.ts), [nativeAuthStorage.ts](../../../../apps/native/src/auth/nativeAuthStorage.ts), [permissionBridge.ts](../../../../apps/native/src/webview/bridge/permissionBridge.ts), [appInfoBridge.ts](../../../../apps/native/src/webview/bridge/appInfoBridge.ts). 최초 안내 검사는 [initial-permission.test.mjs](../../../../apps/native/scripts/initial-permission.test.mjs)이며 모든 기기 권한 상태를 검증하는 테스트는 아니다.

## 화면 준비와 이동

- 브리지 설치 완료인 `closet:native-bridge-ready`와 웹 앱 준비 완료인 `closet:web-app-ready`를 구분한다. 웹 앱 준비 전에 도착한 알림·딥 링크 이동은 대기했다가 처리한다.
- 앱 복귀 때 전달하는 상태 이벤트와 작업 재확인 이벤트를 유지한다. 실행 중 룩북 생성 알림은 자동 화면 이동 대신 기존 웹 완료 팝업에 맡기는 흐름을 확인한다.
- 딥 링크·알림 경로는 `normalizeWebPath`로 내부 경로를 검증하고, hash/browser 라우팅 분기를 유지한다. 외부 URL은 현재 허용된 프로토콜과 외부 브라우저 처리 경로를 따른다.

근거: [NativeWebViewScreen.tsx](../../../../apps/native/src/components/native-webview/NativeWebViewScreen.tsx), [deepLinks.ts](../../../../apps/native/src/navigation/deepLinks.ts), [externalLinkBridge.ts](../../../../apps/native/src/webview/bridge/externalLinkBridge.ts). 알림 경로 검사는 [notification-navigation.test.mjs](../../../../apps/native/scripts/notification-navigation.test.mjs)이며 WebView 준비 시점 자체는 별도 확인이 필요하다.

## 광고와 개인정보

- 웹은 서버가 발급한 광고 세션 ID만 보낸다. 광고 단위·모드는 네이티브가 로그인 세션으로 서버에서 다시 조회하며, 웹에서 받은 광고 설정을 신뢰하지 않는다.
- 광고 표시·보상 이벤트·닫힘·오류를 구분하고 모든 종료 경로의 리스너·타이머를 해제한다. 취소·로드 실패를 지급 성공으로 반환하지 않는다.
- 로컬 테스트 보상 완료 요청과 운영 광고의 서버 검증을 구분한다. 네이티브의 `earned` 응답만으로 지갑을 직접 증가시키지 않는다. 개인정보 설정 열기는 시청·사용권 상태를 바꾸지 않는다.

근거: [rewardedAdBridge.ts](../../../../apps/native/src/webview/bridge/rewardedAdBridge.ts), [presentRewardedAd.ts](../../../../apps/native/src/ads/presentRewardedAd.ts). 관련 검사: [rewarded-ad.test.mjs](../../../../apps/native/scripts/rewarded-ad.test.mjs). 실제 광고 시청·보상 검증은 별도 테스트 환경에서 수행한다.

## 번들과 환경

- 원본 웹·주입 스크립트·생성기를 수정하고 생성된 `src/generated/webBundle.ts`를 직접 고치지 않는다. hash 라우팅, 번들 기준 주소, viewport·safe area와 입력칸 편집 동작을 유지한다.
- 환경 파일 하나의 API 주소가 네이티브와 웹 번들에 동일하게 전달되는지 확인한다. 운영 설정이 없을 때 로컬 값으로 대체하거나 다른 환경의 공개 값을 병합하지 않는다.

근거: [build-environment.mjs](../../../../apps/native/scripts/build-environment.mjs), [sync-web-build.mjs](../../../../apps/native/scripts/sync-web-build.mjs). 관련 검사: [build-environment.test.mjs](../../../../apps/native/scripts/build-environment.test.mjs), [metro-environment.test.mjs](../../../../apps/native/scripts/metro-environment.test.mjs), [native-document.test.mjs](../../../../apps/native/scripts/native-document.test.mjs).
