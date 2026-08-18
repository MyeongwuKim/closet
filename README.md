# closet

매일 반복되는 "오늘 뭐 입지?"를 내 옷장 안에서 해결하기 위한 코디 플래너다. 소유한 옷을 카테고리와 색상별로 기록하고, 특정 옷과 최근에 함께 입었던 조합이나 AI 추천 조합을 확인한 뒤 월~금 계획에 담는 흐름을 목표로 한다.

## 시작한 배경

색 조합을 따로 검색하거나 옷 사진을 대화형 AI에 매번 다시 올리고, 평일 코디를 메모장에 적는 과정은 각각은 간단하지만 반복하기 번거롭다. closet은 이 과정을 하나의 흐름으로 연결한다.

1. 내 옷장에서 기준이 될 옷 선택
2. 최근 함께 입은 옷과 추천 조합 비교
3. 내 옷만 사용하거나 새로운 컬러 조합을 포함해 추천 요청
4. 선택한 조합을 월~금 플래너에 저장

## 현재 구현 범위

- Tailwind CSS 기반 반응형 옷장 화면
- 웹 이미지 파일 선택과 세션 내 미리보기
- AI 카테고리·색상 분류와 사용자 확인·수정 팝업
- 옷 상세, 연관 아이템, 복수 선택 분석 UI
- Zustand 기반 전역 팝업·토스트 관리
- React Router 기반 `plan`, `closet`, `recommend`, `profile` 탭 구조
- 기능별 `features/*/components` 컴포넌트 분리
- Fastify API와 Expo 앱의 실행 가능한 기본 골격
- Web, API, Native에서 공유할 도메인 타입

실제 로그인, 이미지 업로드, 데이터 저장, 날씨 조회, AI 분석은 아직 연결하지 않았다.

## 워크스페이스 구조

```text
closet/
├── apps/
│   ├── web/       # React + Vite 기반 웹
│   ├── api/       # Fastify 기반 API
│   └── native/    # Expo 기반 모바일 앱
├── packages/
│   └── types/     # 옷, 코디, 플래너 공용 타입
├── package.json
└── pnpm-workspace.yaml
```

앱은 사용자 접점에 따라 분리하고, 옷 카테고리와 코디처럼 여러 앱이 같은 의미로 사용해야 하는 모델만 `packages/types`에서 공유한다. UI 컴포넌트는 Web과 Native의 렌더링 방식이 달라 초기에는 억지로 공용화하지 않는다.

## 실행 방법

Node.js 20 이상과 pnpm 10을 기준으로 한다.

```bash
pnpm install
pnpm dev
```

개별 앱은 다음 명령으로 실행한다.

```bash
pnpm dev:web
pnpm dev:api
pnpm dev:native
```

API 상태 확인 주소는 `http://localhost:4000/health`다.

AI 이미지 분류를 사용하려면 API 환경 파일을 만들고 키를 설정한다.

```bash
cp apps/api/.env.example apps/api/.env
```

`apps/api/.env`의 `OPENAI_API_KEY`에 서버 전용 API 키를 입력한다. `OPENAI_MODEL`은 기본값인 `gpt-5-mini` 대신 사용할 이미지 입력 지원 모델을 지정할 때만 설정한다. 키는 웹 코드나 `VITE_` 환경 변수에 넣지 않는다.

## 다음 구현 순서

1. 옷 이미지 업로드와 카테고리·색상 수정
2. 사용자 옷장과 착용 기록 저장
3. 코디 생성기와 월~금 플래너 저장
4. 날씨와 일정 조건을 추천 입력에 반영
5. 이미지 특징과 색상 정보를 사용하는 AI 추천 연결

첫 버전에서는 추천 모델보다 옷 등록과 플래너 저장 흐름을 먼저 완성하는 편이 좋다. 사용자 데이터가 쌓여야 최근 조합과 재착용 빈도를 추천 근거로 사용할 수 있기 때문이다.
