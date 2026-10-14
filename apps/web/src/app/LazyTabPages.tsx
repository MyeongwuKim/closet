import { lazy } from 'react'

/** 플래너 탭 진입 시 하루·주간·월간 화면 코드를 불러온다. */
export const PlanPage = lazy(() =>
  import('../features/plan/pages/PlanPage').then(({ PlanPage }) => ({ default: PlanPage })),
)

/** 옷장 탭 진입 시 옷 목록과 필터 화면 코드를 불러온다. */
export const ClosetPage = lazy(() =>
  import('../features/closet/pages/ClosetPage').then(({ ClosetPage }) => ({ default: ClosetPage })),
)

/** 코디북 탭 진입 시 저장한 코디 목록 화면 코드를 불러온다. */
export const LookbookPage = lazy(() =>
  import('../features/lookbook/pages/LookbookPage').then(({ LookbookPage }) => ({ default: LookbookPage })),
)

/** 설정 탭 진입 시 메뉴와 계정 화면 코드를 불러온다. */
export const SettingsPage = lazy(() =>
  import('../features/settings/pages/SettingsPage').then(({ SettingsPage }) => ({ default: SettingsPage })),
)

/** 스타일 프로필 상세도 설정 모듈과 함께 필요한 경로에서만 불러온다. */
export const StyleProfilePage = lazy(() =>
  import('../features/settings/pages/SettingsPage').then(({ StyleProfilePage }) => ({ default: StyleProfilePage })),
)
