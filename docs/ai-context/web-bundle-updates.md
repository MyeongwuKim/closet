# 웹 번들·앱 업데이트

## 관리하는 JSON

| 파일 | 역할 |
| --- | --- |
| [app-versions.json](../../apps/native/app-versions.json) | dev/prod별 iOS·Android 현재 네이티브 버전. 실제 값은 해당 JSON을 기준으로 한다. 빌드 번호는 기존 app.json/EAS 설정을 따른다. |
| [minimum-app-versions.json](../../apps/native/minimum-app-versions.json) | dev/prod·플랫폼별 강제 업데이트 활성화, `minimumVersion`, `storeUrl`. 실제 주소가 없어서 초기값은 `enabled: false`, `storeUrl: null`이다. |
| [web-bundle-runtime.json](../../config/web-bundle-runtime.json) | 채널별 번들 prefix·호환 최소 네이티브 버전. dev는 루트, prod는 `runtime/v1`이다. 호환되지 않는 브리지 변경 시 새 prefix와 최소 버전을 함께 지정하고 새 바이너리를 배포한다. |

웹 manifest의 `minNativeVersion`은 그 웹 코드를 실행할 수 있는 최소 바이너리다. 강제 업데이트 정책의 `minimumVersion`은 스토어 업데이트 없이는 앱 진입을 허용하지 않을 버전이다. 두 값을 별도로 관리한다. 플랫폼 버전 선택은 `CLOSET_BUILD_PLATFORM` 또는 EAS의 `EAS_BUILD_PLATFORM`이며 기본은 iOS다. iOS 실행기는 iOS를, 기존 Android 명령은 Android를 명시한다.

## R2 저장 구조

채널마다 버킷과 업로드 인증정보를 따로 쓴다. dev 버킷에는 `releases/{version}/web-ui.zip`, `releases/{version}/manifest.json`, `latest/manifest.json`이 생긴다. prod 버킷에는 위 세 경로 앞에 `runtime/v1/`이 붙는다. manifest는 `version`, `minNativeVersion`, `channel`, `bundleUrl`, `entryPath`, `sha256`, `createdAt`, `runtimeReadySignal`을 담는다.

ZIP → 버전별 manifest → latest manifest 순서로 업로드한다. 이후 해당 runtime prefix 안의 최근 release 5개를 유지한다. 업로드 중이거나 정리 실패 시 일시적으로 5개를 넘을 수 있으며 다음 배포에서 정리를 다시 시도한다. 정리 실패는 경고로 남기고 완료된 배포를 실패로 바꾸지 않는다. 언어팩은 포함하지 않는다. 강제 업데이트 정책은 각 버킷의 `native/latest.json`과 이력인 `native/releases/{commit}-{attempt}.json`에 저장하며 웹 release 정리와 분리한다.

## 배포 흐름과 설정

[웹 발행 workflow](../../.github/workflows/publish-web-bundle-r2.yml)는 develop의 웹·공용 타입·생성기·버전·발행 설정 변경 시 dev를 발행한다. prod는 자동 발행하지 않는다. GitHub Actions의 **Publish web bundle to R2 → Run workflow**에서 채널·선택적 웹 버전을 지정한다. 수동 실행 workflow는 GitHub 기본 브랜치에도 파일이 있어야 목록에 표시된다. dev는 공용 타입·웹 단위·발행 스크립트·번들 로더 검사 후 웹 번들 빌드·네이티브 타입·번들 핵심 E2E를 거쳐 배포한다. API 전체 검사와 250개 전체 화면 E2E를 선행하지 않는다.

전체 회귀 검사는 [regression workflow](../../.github/workflows/regression.yml)의 main push 또는 수동 실행에서만 수행한다. prod 웹 수동 발행은 GitHub Actions API로 **배포할 커밋 SHA와 같은 커밋**의 해당 workflow 통과 기록을 확인하고 재사용한다. 다른 커밋·실패·진행 중·취소 기록으로는 배포하지 않는다. 통과 기록이 없으면 전체 검사를 해당 커밋에서 먼저 완료하고 prod 발행을 다시 실행한다. prod 발행이 전체 검사를 중복 실행하지 않는다. 기본 GITHUB_TOKEN의 actions 읽기 권한을 사용하므로 추가 Secret은 필요 없다.

웹 major/minor는 선택 채널의 네이티브 major/minor를 따른다. patch는 해당 버킷·runtime prefix의 최신 manifest에서 증가하며 처음에는 0이다. 양 플랫폼이 참여하면 major/minor가 같아야 한다. 수동 버전도 같은 계열이며 최신 웹 버전보다 커야 한다. 채널별 동시 발행은 직렬화한다.

[네이티브 정책 workflow](../../.github/workflows/publish-native-update-policy-r2.yml)는 develop에서 정책 관련 파일 변경 시 dev에 발행하며 수동 dev/prod 실행도 지원한다. prod는 수동 발행한다. 정책 발행은 Node 22에서 정책 스크립트 테스트와 JSON 검증만 수행하며 의존성 전체 설치·앱 빌드·브라우저 E2E는 실행하지 않는다. 웹 번들 배포가 네이티브 강제 업데이트 정책을 임의 변경하지 않는다. `enabled: true`로 바꾸려면 실제 스토어 URL을 먼저 지정해야 하며 Apple App Store/TestFlight 또는 Google Play URL을 검사한다.

GitHub 저장소 **Settings → Secrets and variables → Actions**에서 다음 이름을 사용한다. Variables는 같은 이름의 Secrets로도 등록할 수 있다. 서로 다른 채널의 누락 값을 상대 채널로 대체하지 않는다.

| 종류 | dev 이름 | prod 이름 | 값·확인 위치 |
| --- | --- | --- | --- |
| Secret | `R2_ACCESS_KEY_ID_DEV` | `R2_ACCESS_KEY_ID_PROD` | Cloudflare R2 API 토큰의 Access Key ID. 각 버킷으로 권한 제한. |
| Secret | `R2_SECRET_ACCESS_KEY_DEV` | `R2_SECRET_ACCESS_KEY_PROD` | 같은 토큰의 Secret Access Key. |
| Variable | `R2_ENDPOINT_DEV` | `R2_ENDPOINT_PROD` | 버킷 Settings의 S3 API 엔드포인트. 버킷명 경로 제외. |
| Variable | `R2_BUCKET_DEV` | `R2_BUCKET_PROD` | 실제 버킷명. |
| Variable | `WEB_BUNDLE_BASE_URL_DEV` | `WEB_BUNDLE_BASE_URL_PROD` | 버킷의 공개 다운로드 URL 또는 연결한 도메인. 운영은 운영용 도메인을 사용한다. |

R2 키는 CI 업로드 단계에만 전달한다. 앱 환경 파일과 Vite 공개 변수에 넣지 않는다. 현재 GraphQL 전송은 `ClosetNative.requestGraphql` → 네이티브 세션·고정 API를 사용하는 기존 브리지다. 원격 번들 CI에는 `VITE_API_URL_DEV/PROD`가 필요하지 않다. 독립 브라우저용 웹의 API 설정은 기존 방식을 따른다.

앱은 local `.env`, development `.env.development`, production `.env.production` 중 선택한 파일 하나를 사용한다. 기존 `EXPO_PUBLIC_API_URL`은 해당 환경 API 주소다. 원격 환경에는 `EXPO_PUBLIC_WEB_BUNDLE_BASE_URL`을 추가하고 **동일 채널의 공개 다운로드 주소**를 넣는다. local에는 필요 없다. 앱 설정이 manifest URL과 정책 URL을 계산한다. 이 네이티브 업데이트 로더는 새 바이너리 배포 후부터 작동한다. 기존 설치 앱에 R2 업로드만으로 로더를 추가할 수는 없다.

## 실행·검증

저장소 루트에서 실행한다.

```sh
pnpm install --frozen-lockfile
pnpm test:web-bundle-scripts
node --test scripts/check-regression-status.test.mjs
pnpm --filter @closet/native test:web-bundle
pnpm validate:native-update-policy
node --test scripts/publish-native-update-policy-r2.test.mjs
pnpm build:web-bundle
pnpm --filter @closet/native exec tsc --noEmit
pnpm test:e2e:web-bundle
pnpm native:ios:local
pnpm native:ios:dev
pnpm native:ios:prod
```

`build:web-bundle`는 외부 업로드 없이 `.web-bundle/dist/index.html`을 만든다. 네이티브와 동일한 생성기를 사용해 JS 모듈·CSS·글꼴·이미지를 인라인하고 hash 라우팅·`https://closet.native/` 기준 주소를 유지한다. CI 타입 검사에 사용할 내장 번들 모듈도 같은 생성기로 만든다. 원격 빌드의 버전은 `CLOSET_WEB_BUNDLE_VERSION`이며 CI resolver가 자동 지정한다. native 개발용 `native:bundle`/`native:web:sync`는 기존 선택 환경 파일 방식이다.

`resolve:web-bundle-version`은 공개 latest를 읽고 CI의 GITHUB_ENV에 버전을 전달한다. `publish:web-bundle:r2`와 `publish:native-update-policy:r2`는 실제 R2에 업로드·정리하므로 로컬 검증에서 실행하지 않는다. 스크립트 테스트는 가짜 AWS CLI와 임시 파일만 사용한다. 브라우저 검사는 생성된 문서의 오프라인 렌더링, 준비 신호 재전송, 네이티브 GraphQL 전송을 확인하며 실제 DB·R2를 호출하지 않는다.

## 앱의 적용·복구

local은 내장 번들을 사용한다. dev/prod는 채널·설치된 네이티브 버전·웹 버전 계열·실패 이력을 확인한 뒤 새 ZIP을 다운로드한다. SHA-256·압축 크기·파일 경로·엔트리를 검증하고 로컬 파일로 저장한다. Expo SDK 54의 파일·다운로드 API에 맞게 구현했으며 `expo-crypto`·`expo-file-system`·`fflate`를 사용한다. 다운로드/검증/해제는 최대 3회 시도하고 실패하면 기존 호환 번들 또는 내장 번들을 유지한다.

검증한 로컬 HTML을 기존 WebView origin으로 실행한다. 준비 완료는 `closet:web-app-ready`이며 브리지 설치 신호와 다르다. 현재 WebView 로드 키를 확인하고 준비 신호를 재요청하며, 앱이 활성일 때 한 번 재로딩한다. 이후에도 실패하면 직전 번들로 복구한다. 새 번들은 준비 완료 후 확정한다. 미확정 번들로 종료되면 다음 시작에서 복구한다. 저장소는 채널·runtime prefix별로 분리한다. 딥 링크·알림 대기·앱 복귀·인증 브리지는 기존 흐름을 유지한다.

앱 시작과 포그라운드 복귀 때 `native/latest.json`을 확인한다. 활성화된 정책의 최소 버전보다 낮으면 WebView 대신 스토어 업데이트 화면을 보여준다. 마지막 유효 정책을 채널별 SecureStore에 저장하고 네트워크 실패 시 재사용한다. 유효 정책을 한 번도 받지 못한 경우에는 앱 진입을 허용한다. local은 이 검사를 하지 않는다.
