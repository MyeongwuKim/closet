---
name: closet-native-bridge-change
description: "closet의 카메라·위치·GraphQL 등 웹과 네이티브 사이의 브리지 계약이나 동작을 변경·수정할 때 사용한다. 순수 웹 문구·스타일 수정이나 코드 검토만 하는 요청에는 사용하지 않는다."
---

# 네이티브 브리지 변경

## 변경 범위 찾기

- [네이티브 맥락의 브리지 부분](../../../docs/ai-context/native.md#브리지와-기기-기능)과 요청에 해당하는 함수부터 확인한다. 번들·환경 설정은 그 경로가 바뀔 때만 추가로 읽는다.
- 웹의 `apps/web/src/native-bridge`, 네이티브의 `apps/native/src/webview/bridge`에서 같은 기능의 호출·처리 경로를 연결한다.
- 웹 인터페이스 `types.ts`, 주입 API `injectedScript.ts`, 요청 형식 `types.ts`, 입력 검증 `messageGuards.ts`, 메시지 분기 `index.ts`, 기능별 handler 중 실제 영향이 있는 파일만 확인한다.

## 구현 시 확인할 계약

- 요청·응답 필드와 요청 ID가 양쪽에서 일치하도록 변경한다. 새 메시지는 타입 선언·입력 검증·주입 API·handler 분기를 연결하고, 공개하는 기능은 앱 정보의 capabilities도 확인한다.
- 응답은 기존 직렬화 함수를 재사용한다. 요청 완료·실패·취소·시간 초과 시 대기 요청과 타이머·리스너를 정리하고, 늦게 도착한 응답으로 종료된 작업을 다시 실행하지 않는다.
- 카메라는 촬영 성공·사용자 취소·권한 거절·오류를, 위치는 조회 성공·권한 거절·위치 서비스 중단·오류를 구분한다. 실패나 취소를 빈 성공 결과로 바꾸지 않는다.
- GraphQL 전송은 네이티브 세션·HTTP 상태·GraphQL 오류·AbortSignal 연결을 확인한다. 웹의 `apps/web/src/lib/graphql.ts`에 있는 전송 선택과 세션 만료 처리를 재사용한다.
- 브라우저에서 브리지가 없는 경우의 기존 경로를 유지한다. 기기 권한 요청·촬영·외부 링크 실행은 해당 사용자 동작과 연결된 기존 흐름을 따른다.

## 해당 기능을 바꿀 때만 추가 확인

아래 표에서 해당하는 절만 읽는다. 다른 기능의 세부 절차를 함께 불러오지 않는다.

| 변경 대상 | 추가 기준 |
| --- | --- |
| GraphQL·메시지·취소 | [전송과 요청 정리](references/bridge-cases.md#전송과-요청-정리) |
| 촬영 데이터·위치 결과 | [촬영과 위치 결과](references/bridge-cases.md#촬영과-위치-결과) |
| 로그인·권한·기능 노출 | [세션과 권한](references/bridge-cases.md#세션과-권한) |
| 준비 신호·앱 복귀·딥 링크·외부 링크 | [화면 준비와 이동](references/bridge-cases.md#화면-준비와-이동) |
| 광고 보상·개인정보 설정 | [광고와 개인정보](references/bridge-cases.md#광고와-개인정보) |
| 주입 문서·빌드 환경 | [번들과 환경](references/bridge-cases.md#번들과-환경) |

## 관련 부분만 검증

| 바뀐 기능 | 우선 검사 |
| --- | --- |
| 카메라 | `pnpm --filter @closet/native test:camera-bridge` |
| 위치 | `pnpm --filter @closet/native test:location-bridge` |
| GraphQL·취소·시간 초과 | `pnpm --filter @closet/api exec node --import tsx --test ../native/scripts/graphql-bridge.test.mjs` |
| 알림 이동 | `pnpm --filter @closet/api exec node --import tsx --test ../native/scripts/notification-navigation.test.mjs` |
| 광고 보상 | `pnpm --filter @closet/native exec node --test scripts/rewarded-ad.test.mjs` |
| 최초 권한 순서 | `pnpm --filter @closet/native test:initial-permission` |
| 번들·문서 생성 | `pnpm --filter @closet/native test:web-sync` |
| 환경 전달·Metro | `pnpm --filter @closet/native test:build-environment` |

명령은 저장소 루트 기준이다. GraphQL·알림 테스트는 TypeScript를 직접 import하므로 API에 설치된 `tsx`로 실행한다. 현재 Node 20에서 로더 없는 `node --test`는 해당 파일들을 읽지 못한다.

바뀐 계약이나 실패 조건을 재현하는 관련 테스트부터 선택한다. 웹 호출부를 바꾸면 웹 타입 검사도 포함한다. 네이티브 `typecheck`는 웹 빌드·번들 생성을 포함하므로 실행 전 해당 환경 준비 여부를 확인한다.

표의 테스트가 세션 저장·모든 권한 상태·WebView 준비 순서까지 모두 검증하는 것은 아니다. 관련 검사가 없으면 변경한 조건에 맞는 검증을 선택한다. 실제 기기 권한 팝업·카메라 화면·앱 복귀 동작이 달라지면 영향받는 기기 흐름도 확인하고, 단위 테스트 결과와 기기에서 확인한 결과를 구분해 보고한다.
