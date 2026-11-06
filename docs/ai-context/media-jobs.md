# 이미지와 생성 작업 맥락

## 옷 이미지 업로드

[saveWardrobeItem.ts](../../apps/web/src/features/closet/api/saveWardrobeItem.ts)는 서버 업로드 준비 → Cloudflare Images 전송 → 업로드 확인 → 옷장 저장을 연결한다. 서버의 [image.service.ts](../../apps/api/src/features/image/image.service.ts)는 이미지 메타데이터·상태·소유권과 전달 URL을 관리한다.

옷장 항목은 원본 이미지와 표시용 이미지를 구분한다. 분석 결과 확인 단계의 브라우저 object URL과 서버의 영속 이미지 자산은 별개다. 임시 URL 정리는 Store와 AppLayout 종료 경로에 있다.

[useWardrobeImageAnalysis.ts](../../apps/web/src/features/closet/hooks/useWardrobeImageAnalysis.ts)는 여러 번 추가한 사진을 같은 세션의 대기열에 넣고, 한 장의 분류와 배경 제거를 끝낸 뒤 다음 장을 분석한다. 일시 오류가 난 원본은 옷장에서 다시 시도하거나 제외할 수 있고, 준비된 사진은 별도 확인 대기열에서 저장한다. 앱 탭 사이를 오가는 동안 분석 대기열을 유지한다. 로그아웃·계정 변경으로 로그인 후 화면을 떠나면 요청을 중단하고 임시 사진을 정리한다.

## 생성 작업과 복구

| 역할 | 진입점 |
| --- | --- |
| 웹의 요청 번호·진행 작업 복원 | [previewJobQueries.ts](../../apps/web/src/features/lookbook/api/previewJobQueries.ts) |
| 완료 이미지 조회·계정과 조합별 결과 복원 | [useCompletedOutfitPreview.ts](../../apps/web/src/features/lookbook/hooks/useCompletedOutfitPreview.ts) |
| 요청 검증·중복 접수·공개 상태·결과 경로 | [preview-job.service.ts](../../apps/api/src/features/outfit/preview-job.service.ts) |
| 영속 큐·예약·임대·상태 전환 | `apps/api/src/features/outfit/preview-job.repository.ts` |
| 생성·저장·중단 작업 복구 | [preview-job.worker.ts](../../apps/api/src/features/outfit/preview-job.worker.ts) |

같은 요청 번호는 재접수하지 않고 같은 입력의 진행 작업도 공유한다. 동기 호환 API의 응답 대기가 끝나도 서버 작업을 취소하거나 새로 생성하지 않는다.

웹의 `useGenerateOutfitPreviewJobMutation(inputScope)`는 계정·정렬된 옷 ID·스타일별 전역 mutation, 서버 작업 목록과 저장된 작업 ID를 함께 확인한다. 화면 이동·새로고침 후에도 복원 확인 중이거나 같은 입력의 작업이 진행 중이면 새 생성 버튼을 비활성화한다. 실제 실행도 같은 입력의 진행 Promise를 공유하고, 알려진 작업 ID·서버 진행 작업은 사용권 확인이나 새 접수 없이 이어받는다. 다른 조합·계정은 별도 범위이며 실패·중단이 확정되면 이전 요청 번호를 해제한다.

플래너 날짜 상세도 `OutfitPreviewDialogView`로 진행·완료·실패를 표시한다. 팝업을 닫거나 화면 이동·새로고침 후 돌아와도 ‘생성 과정 보기’로 기존 작업의 진행 팝업을 다시 연다. 이 동작은 `resumeExistingAsync`로 알려진 작업만 조회하며, 클릭 전후 완료·실패로 바뀌어도 새 생성·사용권 확인으로 넘어가지 않는다. 결과의 날짜 저장·코디북 추가 경로는 기존 저장 동작을 사용한다.

완료 결과는 계정·정렬된 옷 ID·스타일별 작업·이미지 자산 번호를 로컬에 기한 없이 보관하며 이미지 URL은 저장하지 않는다. 로컬 기록이나 알림 목록이 없어도 `outfitPreviewForItems(selectedItemIds, style)`가 소유한 보유 옷을 검증하고 ImageAsset의 생성 입력 메타데이터로 최신 동일 조합·스타일 이미지를 조회한다. 반환 `CompletedOutfitPreview`는 이미지 정보와 nullable `jobId`, `createdAt`을 담는다. 알림 확인·목록 10개 제한·AiPreviewJob의 정리 TTL과 이미지 보관·재조회는 독립적이다.

플래너 상세는 복귀·새로고침 후 ‘AI 룩북 보기’로 완료 이미지를 연다. `completedPreview`는 조회한 완료 이미지, `hasCompletedPreview`는 복원할 완료 포인터, `isRestoringCompleted`는 영속 조회 또는 이미지 조회 중 여부다. 일시 오류는 `restoreCompletedAsync`로 조회만 재시도하고, 삭제·소유권 거절이 확정되면 포인터를 해제한다. 로컬 기록 없이 영속 조회가 실패하면 `isCompletedLookupError`로 새 생성 대신 조회 재시도를 표시한다. 새 생성이나 사용권 차감으로 자동 전환하지 않는다.

코디 맞춰보기·코디 상세·오늘 추천도 같은 영속 결과를 기존 이미지 보기 팝업으로 연다. 원피스 단독을 포함한 완성 코디에서 조회하며, 서버는 해당 옷의 소유권과 구성 조건을 확인한다. 기존 결과 보기와 조회 재시도는 사용권을 요구하지 않고, 사용자가 ‘다시 만들기’를 선택한 경우에만 새 생성 흐름을 실행한다.

복구는 제공자 요청 여부와 저장된 결과에 따라 달라진다. 저장된 이미지는 기존 결과로 완료할 수 있고, 요청 전 중단 작업은 재대기할 수 있다. 요청 후 결과를 확인할 수 없는 작업은 `interrupted`로 남아 자동 재과금을 막는다.

결과 확인 처리는 작업 목록에서 숨기는 동작이며 이미지 생성·삭제와 별개다. 전경에서 이미 본 이미지의 늦은 완료 알림은 생략하고 확인 처리한다. 전경의 완료 팝업은 웹 공통 UI가, 기기 알림은 `apps/api/src/features/push`와 네이티브 알림 코드가 연결한다.

## 체형·옷 기장 보존

생성은 최신 신체 프로필·선택한 옷의 실측과 이미지를 참고하며 실측 수준의 피팅을 보장하지 않는다. 프로필 변경은 과거 이미지를 바꾸지 않는다. 프롬프트·레이어 보조 도식·합성 평가를 수정할 때만 [룩북 체형과 기장](lookbook-proportions.md)을 읽는다.

## 이미지 보관·교체·정리 배치

생성 결과에는 1시간 조회 제한을 두지 않는다. 파일과 레코드가 남아 있고 삭제 중이 아니면 예전 `temporary` 결과도 조회·복구할 수 있다. `retention: permanent`, `expiresAt: null`은 시간 경과만으로 조회를 막지 않는다는 뜻이며, 참조 없는 이미지를 무조건 보존하는 뜻이 아니다. 코디북 또는 살아 있는 플래너 코디에서 사용하는 이미지는 보관하고, 미저장 고아는 생성 후 24시간이 지나면 배치 삭제 대상이 된다.

[outfit-preview-storage.ts](../../apps/api/src/features/outfit/outfit-preview-storage.ts)는 저장할 코디와 생성 자산의 옷 구성을 비교하고 같은 자산 번호를 재사용한다. 웹은 `OutfitPreviewImageInput`에 `assetId` 또는 `imageBase64` 중 하나와 모델·형식만 전달하며 조회 URL을 입력에 섞지 않는다. 새 이미지로 저장하면 이전 generation 연결을 교체하고, 옷 구성만 변경한 경우에는 기존 이미지 연결을 해제한다. 날짜 코디는 별도 행으로 복사하면서 같은 이미지 자산 번호를 재사용한다. 플래너에서 코디북으로 저장할 때 원본을 승격·병합하지 않으며 이미 있는 코디북의 사진도 자동 교체하지 않는다. 새 저장 실패에는 기존 연결·파일을 유지한다. 저장 실패한 새 결과는 즉시 삭제하지 않고 24시간 고아 정리에 맡긴다.

코디 만들기의 저장 확인 화면에서 스타일 분류를 여러 번 바꿔도 완성한 AI 이미지와 자산 번호를 유지해 함께 저장한다. 생성 이미지는 같은 옷 조합 안에서 새 스타일 키로 옮기며, 옷 구성을 바꾸면 기존처럼 무효화한다.

교체·코디 삭제의 커밋이 성공한 뒤 이전 AI 생성 자산을 정리한다. 다른 코디·플래너·옷 사진 또는 진행·복구 중인 생성 작업이 사용하면 삭제하지 않는다. 생성 이미지의 새 연결과 삭제 claim은 같은 ImageAsset 행을 같은 DB 트랜잭션 안에서 써 경합을 막는다. 플래너 신규 복사·배정·일정 이동에도 이 잠금을 사용한다. 코디북에서 교체·삭제한 사진을 날짜 복사본이 사용 중이면 과거 기록의 이미지로 계속 보관한다. 플래너 어디에도 배정되지 않은 숨은 `plannerOnly` 코디의 generation은 고아 claim 안에서 해제한다.

삭제는 `deleting` 상태와 임대 시각을 기록한 뒤 Cloudflare → DB 순서로 진행한다. CF 삭제 실패 또는 DB 정리 실패에는 기록과 재시도 시각을 남기고, 다음 배치가 다시 시도한다. CF의 이미 없는 파일(404)은 삭제 완료로 취급한다. 삭제 중 이미지는 새 코디에 연결할 수 없다. 삭제 확정 응답은 웹의 해당 계정·자산 포인터와 이전 URL 캐시도 정리한다.

삭제된 옷의 원본·누끼 사진은 [archived-wardrobe-image-cleanup.repository.ts](../../apps/api/src/features/image/archived-wardrobe-image-cleanup.repository.ts)가 정리한다. 사진에 연결된 모든 옷이 보관 삭제 상태이고 살아 있는 코디북·플래너 날짜·대기/진행 중 AI 작업에서 쓰지 않을 때만 후보가 된다. 공유 사진을 다른 옷이 쓰거나 다른 계정의 연결·generation 연결이 있으면 보존한다. 옷 행은 남기고 CF 삭제 성공 후 사진 연결과 자산만 같은 트랜잭션에서 해제한다. CF·DB 실패는 삭제 중 상태와 재시도 시각을 남긴다. 어느 날짜에도 배정되지 않은 숨은 `plannerOnly` 구성은 보존 근거로 세지 않는다.

[wardrobe-image-lifecycle.ts](../../apps/api/src/features/wardrobe/wardrobe-image-lifecycle.ts)는 새 옷·코디·플래너 복사/이동·AI 예약과 정리 claim이 같은 `AiLease` 전용 잠금 키를 쓰게 한다. 잠금은 해당 연결 저장과 같은 트랜잭션 안에서 잡고 삭제 중 사진의 새 연결을 거절한다. 원본 옷·사진의 수정 시각을 잠금 용도로 바꾸지 않아 AI fingerprint가 달라지지 않는다. 삭제된 옷은 기존 살아 있는 기록을 복사·이동할 때만 재사용하고, 정리 후 숨은 고아 코디를 통한 재연결은 거절한다.

DB에 기록이 있는 고아·삭제 옷 사진 정리 명령은 루트에서 `pnpm api:cleanup:outfit-previews --limit=100`이다. 기본은 후보 조회뿐이며 실제 삭제는 `pnpm api:cleanup:outfit-previews --execute --limit=100`으로 실행한다. [image-cleanup.batch.ts](../../apps/api/src/features/image/image-cleanup.batch.ts)는 두 종류의 후보를 생성 시각·ID순으로 합쳐 전체 `--limit` 안에서 처리하므로 AI 후보가 많아도 더 오래된 옷 사진이 밀리지 않는다. 미저장 AI 결과에만 생성 후 24시간 기준을 적용하며, 삭제된 옷 사진은 현재 사용 여부로 판단한다. 각 claim에서 참조·작업을 재검사하므로 실행 시 실제 삭제 건수는 줄어들 수 있다.

DB 기록 자체가 없는 원격 고아는 별도 `pnpm api:cleanup:cloudflare-orphans --limit=100 --max-pages=10`으로 확인한다. `--execute`가 있어야 삭제한다. [Cloudflare V2 목록 API](https://developers.cloudflare.com/api/resources/images/subresources/v2/methods/list/)의 앱 생성 메타데이터·업로드 시각으로 소유 범위를 좁히며, 24시간이 지났고 어떤 ImageAsset 기록도 없고 같은 계정에 진행 중 생성 작업도 없는 파일만 대상이다. 실제 삭제 전 unique Cloudflare ID를 가진 `deleting` 기록을 원자 생성해 뒤늦은 저장을 막으며, CF·DB 삭제 실패는 DB 배치 재시도에 합류한다. 이 원격 정리 기록은 재시도할 때도 같은 계정의 진행 작업을 보호한다. 이 명령은 기존 CF 인증 환경 변수를 사용하고 실제 계정 조회 권한이 필요하다. [cloudflare-orphan-cleanup.batch.ts](../../apps/api/src/features/image/cloudflare-orphan-cleanup.batch.ts)는 `CF_ACCOUNT`별 `CloudflareCleanupCursor`를 읽고 성공한 삭제 실행 뒤에만 다음 페이지를 저장한다. 페이지 끝에서는 처음으로 순환하고, 삭제 한도에 닿은 페이지는 다시 읽어 남은 후보를 건너뛰지 않는다. 조회 전용·삭제 실패·반복 토큰에는 진행점을 바꾸지 않으며 revision 비교로 겹친 배치의 오래된 완료를 거절한다. 진행점은 DB에 있으므로 Cloud Run Job의 프로세스가 바뀌어도 이어간다.

두 명령 모두 API의 `tsx src/cli/...` 스크립트로 실행된다. 저장소에는 자동 실행 스케줄이 등록되어 있지 않으므로 운영 배치 실행 시각·환경 설정은 별도 등록해야 한다. 실제 운영 파일 삭제는 코드 검증에 포함하지 않는다.

## 실행기와 사용권

[shared-ai-executor.ts](../../apps/api/src/lib/ai/shared-ai-executor.ts)는 서버 간 결과 캐시·중복 실행·실행량·동시 작업 슬롯을 관리한다. [ai-storage.ts](../../apps/api/src/lib/ai/ai-storage.ts)는 컬렉션·TTL 인덱스와 트랜잭션을 준비한다. 트랜잭션 충돌 재시도와 외부 AI 요청은 분리되어 있다.

사용자의 추천·미리보기는 공통 AI 지갑을 사용한다. 최대 보유량·시간 충전은 [ai-credit-wallet-policy.ts](../../apps/api/src/features/preview-credits/ai-credit-wallet-policy.ts), 지갑 변경은 같은 폴더의 `ai-credit-wallet.repository.ts`에 있다. 이전 날짜별 예약·보상 데이터와 추천 결과의 날짜 키도 남아 있지만 공통 지갑의 시간 충전은 날짜 리셋과 별개다.

추천 예약·결과 재사용·실패 반환은 `recommendation-credit.service.ts`와 저장소가, 미리보기 예약·완료·실패 반환은 작업 저장소가 처리한다. 웹의 [requireAiCredit.ts](../../apps/web/src/features/lookbook/api/requireAiCredit.ts)는 실행 전에 잔액을 확인할 뿐 직접 차감하지 않는다.

## 광고 보상과 테스트 충전

네이티브는 서버가 발급한 광고 세션을 다시 조회한다. 운영 보상은 [admob.routes.ts](../../apps/api/src/features/preview-credits/admob.routes.ts)의 공개 SSV 주소에서 서명·광고 단위·세션·거래 정보를 검증한 뒤 지급한다. 클라이언트의 시청 완료와 서버의 지급 완료는 별개다.

[preview-credit.service.ts](../../apps/api/src/features/preview-credits/preview-credit.service.ts)는 테스트 보상과 개발용 지갑 충전을 제공하며 운영 환경에서는 거절한다. 모드 선택은 `preview-credit-policy.ts`와 `NODE_ENV`를 사용한다.

## 관련 검사

API의 `image-permanent-preview.test.ts`, `image-orphan-cleanup.test.ts`, `image-remote-tombstone-guard.test.ts`, `cloudflare-orphan-cleanup.service.test.ts`, `cloudflare-orphan-cleanup.batch.test.ts`, `outfit-preview-storage.test.ts`, `outfit-image-replacement.test.ts`, `planner-image-reference.test.ts`, `preview-result.service.test.ts`와 웹의 완료 포인터·캐시·복원 검사가 관련된다. E2E에는 `tests/planner-preview-progress.spec.ts`, `tests/preview-job-recovery.spec.ts`, `tests/preview-credits.spec.ts`, `tests/recommendation-credits.spec.ts`가 있다. 실제 이미지 DB 통합 검사의 전용 DB·독립 프로세스 조건은 [통합 검사 표](development.md#단위-테스트와-통합-테스트)에 모아 둔다.

삭제 옷 사진은 `archived-wardrobe-image-cleanup.test.ts`, `image-cleanup.batch.test.ts`, `wardrobe-image-lifecycle.test.ts`, `wardrobe-reference-guards.test.ts`와 실제 DB의 `archived-wardrobe-image-cleanup.integration.test.ts`로 검사한다. 실제 공유 사진 연결·정리의 잠금 경합, 실패 후 재시도, 과거 착용 보존과 원본 수정 시각 불변을 확인한다.

서비스 메서드를 대체하는 단위 검사와 실제 DB 잠금·정산을 확인하는 통합 검사는 범위가 다르다. DB 격리 조건·실제 AI 검사 구분은 [개발과 검증](development.md#단위-테스트와-통합-테스트)에 있다.
