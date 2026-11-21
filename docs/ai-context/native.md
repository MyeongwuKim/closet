# 네이티브 맥락

## 화면과 번들

[App.tsx](../../apps/native/src/App.tsx)는 Expo·React Native 앱의 권한 안내·인증·연결 오류·메인 화면을 전환한다. 초기 화면 준비와 스플래시 해제를 연결하며, 로그인 후 [NativeWebViewScreen.tsx](../../apps/native/src/components/native-webview/NativeWebViewScreen.tsx)가 웹 번들을 표시한다.

[sync-web-build.mjs](../../apps/native/scripts/sync-web-build.mjs)는 웹 빌드에서 `apps/native/src/generated/webBundle.ts`를 생성한다. WebView의 기준 주소는 `https://closet.native/`다. 웹 개발 서버와 앱 안의 번들은 별개이며, `pnpm native:web:sync`는 번들 생성 후 실행 앱을 다시 불러온다.

원격 웹 번들·강제 업데이트 정책·R2 경로·GitHub 설정·검증 명령은 [웹 번들·앱 업데이트](web-bundle-updates.md)에 있다. local은 내장 번들을, dev/prod는 채널·호환성·해시를 검사한 로컬 저장본을 사용한다. 현재 버전은 `apps/native/app-versions.json`, 스토어 강제 업데이트 정책은 `apps/native/minimum-app-versions.json`이다.

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

브리지 설치 완료인 `closet:native-bridge-ready`와 웹 앱 준비 완료인 `closet:web-app-ready`는 별개다. WebView는 웹 앱 준비 전에 받은 이동 요청을 보관했다가 처리한다. 웹 준비 신호의 로드 키가 현재 WebView와 일치해야 번들을 확정하며, 신호 재요청·재로딩·이전 번들 복구는 `src/webBundle/webViewReadyRecovery.ts`와 `NativeWebViewScreen.tsx`에 있다.

`closet:web-first-frame`은 네이티브가 현재 WebView에 주입한 코드에서 보내는 표시 전용 신호다. 같은 로드 키에서만 수락하며 로딩 화면을 닫는 데 사용한다. 번들 확정과 복구는 웹 앱 준비 신호를 기준으로 처리한다.

앱 복귀 시 웹에 상태·재활성 이벤트를 전달해 작업과 날씨를 다시 확인한다. [notificationNavigation.ts](../../apps/native/src/notifications/notificationNavigation.ts)는 알림 경로를 정규화하고 실행 중 룩북 완료 알림의 자동 이동을 생략한다. 딥 링크는 [deepLinks.ts](../../apps/native/src/navigation/deepLinks.ts), hash/browser 이동은 `webViewNavigation.ts`, 외부 링크는 `externalLinkBridge.ts`에 있다.

`wardrobe-rediscovery` 푸시는 `/closet/rediscovery`만 허용하며 수신 즉시 화면을 바꾸지 않는다. 사용자가 누르면 기존 마지막 알림 복구·인증·웹 준비 대기 경로를 거쳐 전체 화면 재발견 목록을 연다. `notification-navigation.test.mjs`에서 전용 경로·외부 경로 거절·전면 자동 이동 생략을 검사한다.

## 빌드 환경과 검사

| 설정 | 위치 |
| --- | --- |
| 앱 이름·식별자·URL scheme의 환경별 구분 | [appVariant.cjs](../../apps/native/config/appVariant.cjs) |
| Expo 앱 설정·광고 plugin·extra | [app.config.js](../../apps/native/app.config.js) |
| EAS 빌드 프로필의 환경 선택 | [eas.json](../../apps/native/eas.json) |
| 선택한 환경의 변수 전달 | [build-environment.mjs](../../apps/native/scripts/build-environment.mjs), `metro.config.js` |

환경은 `WEAROOM_APP_ENV`로 선택하며 local은 `.env`, development는 `.env.development`, production은 `.env.production` 하나를 사용한다. 선택한 `EXPO_PUBLIC_API_URL`은 웹 번들의 `VITE_API_URL`에도 전달된다. 다른 환경의 `EXPO_PUBLIC_*` 값은 가져오지 않는다.

관련 검사는 `apps/native/scripts`의 브리지·권한·알림·광고·번들·환경 테스트다. 네이티브 `typecheck`는 웹 빌드·번들 생성을 먼저 수행한다. TypeScript 직접 import 테스트의 로더와 개별 실행 명령은 [개발과 검증](development.md#단위-테스트와-통합-테스트)에 있다.

## iOS 빌드 확인과 Xcode 이름

`native:ios:dev`와 `native:ios:prod`는 `app-versions.json`에서 해당 채널의 iOS 버전을 읽고 앱 이름·버전·식별자와 해당 채널의 강제 업데이트 최소 버전·활성 여부·스토어 URL·웹 번들 최소 네이티브 버전을 로컬 JSON 기준으로 표시한다. 웹 번들 호환 기준이나 활성 강제 업데이트 정책의 최소 버전보다 낮은 빌드는 확인 질문 전에 중단한다. 대화형 터미널에서 `y` 또는 `yes`를 입력해야 웹 생성·prebuild·서명을 시작한다. 빈 입력이나 다른 답은 취소하고, 비대화형 실행은 거절한다. local은 확인을 생략하고 `apps/native/ios/closet.xcworkspace`의 `wearroomL` Debug scheme으로 Metro와 시뮬레이터를 실행한다. dev와 prod 명령은 각각 `apps/native/ios-dev/웨어룸(T).xcworkspace`, `apps/native/ios-prod/웨어룸.xcworkspace`를 준비하고 종료한다. 세 환경의 네이티브 프로젝트와 Pods는 각자 해당 폴더에 있다. dev·prod 내장 웹 번들도 채널별로 생성하고 Xcode에서 빌드할 때 해당 채널의 번들을 사용한다.

설치 표시 이름은 개발 `웨어룸(T)`, 운영 `웨어룸`이다. Xcode scheme도 개발 `웨어룸(T)`, 운영 `웨어룸`이다. Xcode 제품 이름은 개발 `wearroomT`, 운영 `wearroom`이다. local scheme·제품은 `wearroomL`이고 설치 표시 이름은 기존 `wearroom(L)`이다. `plugins/with-ios-build-identity.cjs`가 prebuild 때 기존 타깃·서명을 유지하면서 현재 환경의 scheme과 `MARKETING_VERSION`을 갱신한다. Xcode 프로젝트와 앱 타깃도 개발 `웨어룸(T)`, 운영 `웨어룸`이다. dev·prod 명령은 prebuild 후 프로젝트와 타깃 이름을 바꾸고 Pods 연결을 갱신한다. 다음 prebuild는 해당 환경의 프로젝트를 Expo가 사용하는 기본 프로젝트 이름으로 복구한 뒤 실행한다. iOS 준비 명령은 선택한 환경과 공개 설정을 각 iOS 폴더의 `.xcode.env`에 반영해, Xcode에서 별도로 Archive할 때도 Expo 설정과 JS 번들이 같은 환경을 사용하게 한다. Xcode에서 현재 환경의 scheme을 선택하며, 실행 명령도 `--scheme`을 명시한다. 버전 변경은 `app-versions.json`을 수정한 뒤 해당 명령을 다시 실행한다. 빌드 번호는 기존 설정을 유지한다. 검사는 `pnpm --filter @closet/native test:ios-build`다.
