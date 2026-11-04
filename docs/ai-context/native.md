# 네이티브 맥락

## 화면과 번들

[App.tsx](../../apps/native/src/App.tsx)는 Expo·React Native 앱의 권한 안내·인증·연결 오류·메인 화면을 전환한다. 초기 화면 준비와 스플래시 해제를 연결하며, 로그인 후 [NativeWebViewScreen.tsx](../../apps/native/src/components/native-webview/NativeWebViewScreen.tsx)가 웹 번들을 표시한다.

[sync-web-build.mjs](../../apps/native/scripts/sync-web-build.mjs)는 웹 빌드에서 `apps/native/src/generated/webBundle.ts`를 생성한다. WebView의 기준 주소는 `https://closet.native/`다. 웹 개발 서버와 앱 안의 번들은 별개이며, `pnpm native:web:sync`는 번들 생성 후 실행 앱을 다시 불러온다.

## 브리지와 기기 기능

| 역할 | 위치 |
| --- | --- |
| 웹 호출 인터페이스 | [native-bridge/types.ts](../../apps/web/src/native-bridge/types.ts)와 같은 폴더의 기능별 함수 |
| 주입 API·메시지 분기 | [injectedScript.ts](../../apps/native/src/webview/bridge/injectedScript.ts), [bridge/index.ts](../../apps/native/src/webview/bridge/index.ts) |
| 요청 형식·검증·응답 | `apps/native/src/webview/bridge`의 `types.ts`, `messageGuards.ts`, `responses.ts` |
| 인증·권한·알림 | `apps/native/src/auth`, `src/permissions`, `src/notifications` |
| 앱 기능·권한 상태 노출 | [appInfoBridge.ts](../../apps/native/src/webview/bridge/appInfoBridge.ts) |

브리지는 GraphQL 전송, 촬영, 위치, 권한, 앱 설정, 인증 동기화, 광고, 외부 링크를 연결한다. 요청 ID에 따른 응답·시간 제한·GraphQL 취소 경로가 있다. 네이티브 GraphQL은 앱 환경의 API 주소와 네이티브 세션을 사용한다.

인증은 SecureStore와 웹 토큰의 동기화로 이어진다. 권한 상태 조회와 시스템 권한 요청은 분리되어 있고, 허용된 로그인 기기는 푸시 토큰을 등록한다. 카메라·위치 결과는 성공 외에 취소·거절·오류 등을 상태값으로 전달한다.

## 준비 신호와 화면 이동

브리지 설치 완료인 `closet:native-bridge-ready`와 웹 앱 준비 완료인 `closet:web-app-ready`는 별개다. WebView는 웹 앱 준비 전에 받은 이동 요청을 보관했다가 처리한다.

앱 복귀 시 웹에 상태·재활성 이벤트를 전달해 작업과 날씨를 다시 확인한다. [notificationNavigation.ts](../../apps/native/src/notifications/notificationNavigation.ts)는 알림 경로를 정규화하고 실행 중 룩북 완료 알림의 자동 이동을 생략한다. 딥 링크는 [deepLinks.ts](../../apps/native/src/navigation/deepLinks.ts), hash/browser 이동은 `webViewNavigation.ts`, 외부 링크는 `externalLinkBridge.ts`에 있다.

## 빌드 환경과 검사

| 설정 | 위치 |
| --- | --- |
| 앱 이름·식별자·URL scheme의 환경별 구분 | [appVariant.cjs](../../apps/native/config/appVariant.cjs) |
| Expo 앱 설정·광고 plugin·extra | [app.config.js](../../apps/native/app.config.js) |
| EAS 빌드 프로필의 환경 선택 | [eas.json](../../apps/native/eas.json) |
| 선택한 환경의 변수 전달 | [build-environment.mjs](../../apps/native/scripts/build-environment.mjs), `metro.config.js` |

환경은 `WEAROOM_APP_ENV`로 선택하며 local은 `.env`, development는 `.env.development`, production은 `.env.production` 하나를 사용한다. 선택한 `EXPO_PUBLIC_API_URL`은 웹 번들의 `VITE_API_URL`에도 전달된다. 다른 환경의 `EXPO_PUBLIC_*` 값은 가져오지 않는다.

관련 검사는 `apps/native/scripts`의 브리지·권한·알림·광고·번들·환경 테스트다. 네이티브 `typecheck`는 웹 빌드·번들 생성을 먼저 수행한다. TypeScript 직접 import 테스트의 로더와 개별 실행 명령은 [개발과 검증](development.md#단위-테스트와-통합-테스트)에 있다.
