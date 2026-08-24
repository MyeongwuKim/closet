# @closet/web

옷장 탐색, 코디 추천, 주간 플래너 흐름을 먼저 검증하는 React 웹 앱이다. 스타일은 Tailwind CSS 4와 공식 Vite 플러그인으로 구성한다.

## 주요 화면 책임

- `/plan`: 월~일 주간 코디 목록
- `/plan/:date`: 날짜별 코디 상세
- `/closet`: 옷장 목록, 이미지 업로드, 복수 선택
- `/closet/:itemId`: 옷 상세와 함께 매칭한 아이템
- `/recommend`: AI 추천 화면
- `/profile`: 사용자 설정 화면
- 반응형 옷장 그리드와 카테고리 필터
- 웹 이미지 파일 선택과 세션 내 미리보기
- 업로드 이미지의 AI 분류 요청과 결과 확인·수정 팝업
- 선택한 옷의 상세 화면과 연관 아이템 가로 스크롤
- 단일 옷 분석과 복수 선택 분석 UI
- Zustand 기반 전역 팝업·토스트 상태 관리

## 프론트엔드 구조

```text
src/
├── app/router.tsx
├── components/
│   ├── layout/           # 공통 헤더와 모바일 탭
│   └── ...               # 전역 팝업과 토스트
├── features/
│   ├── plan/
│   │   ├── components/
│   │   ├── data/
│   │   └── pages/
│   └── closet/
│       ├── api/
│       ├── components/
│       ├── data/
│       ├── pages/
│       └── stores/
└── stores/               # 전역 UI 상태
```

화면에서만 쓰는 컴포넌트는 해당 `features/*/components`에 두고, 여러 탭에서 공유하는 레이아웃과 전역 UI만 `components`에 둔다.

업로드한 이미지는 현재 브라우저 메모리에서만 관리하므로 새로고침하면 사라진다. API에 `OPENAI_API_KEY`를 설정하면 카테고리·대표 색상을 분석하고, 결과 확인 팝업에서 사용자가 수정한 뒤 확정할 수 있다. 영구 저장과 추천 결과 저장은 이후 데이터베이스 연동 단계에서 연결한다.

## 실행

루트에서 다음 명령을 실행한다.

```bash
pnpm web:dev
```
