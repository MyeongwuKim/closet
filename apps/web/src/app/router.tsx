import {
  Navigate,
  createBrowserRouter,
  createHashRouter,
} from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { RequireAuth } from '../features/auth/components/RequireAuth'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { ClosetDetailPage } from '../features/closet/pages/ClosetDetailPage'
import { ClosetPage } from '../features/closet/pages/ClosetPage'
import { LookbookPage } from '../features/lookbook/pages/LookbookPage'
import { OutfitComposerPage } from '../features/lookbook/pages/OutfitComposerPage'
import { PlanDetailPage } from '../features/plan/pages/PlanDetailPage'
import { PlanPage } from '../features/plan/pages/PlanPage'
import {
  SettingsPage,
  StyleProfilePage,
} from '../features/settings/pages/SettingsPage'
import { AppInfoPage } from '../features/settings/pages/AppInfoPage'
import { NotificationWeatherPage } from '../features/settings/pages/NotificationWeatherPage'
import { isNativeWebViewRuntime } from '../native-bridge'

const createRouter = isNativeWebViewRuntime()
  ? createHashRouter
  : createBrowserRouter

export const router = createRouter([
  { path: 'login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/plan" replace /> },
          { path: 'plan', element: <PlanPage /> },
          { path: 'plan/:date', element: <PlanDetailPage /> },
          {
            path: 'plan/:date/item/:itemId',
            element: <ClosetDetailPage />,
          },
          {
            path: 'closet',
            element: <ClosetPage />,
            children: [{ path: ':itemId', element: <ClosetDetailPage /> }],
          },
          { path: 'lookbook', element: <LookbookPage /> },
          { path: 'lookbook/new', element: <OutfitComposerPage /> },
          { path: 'recommend', element: <Navigate to="/lookbook" replace /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'settings/style-profile', element: <StyleProfilePage /> },
          {
            path: 'settings/notifications-weather',
            element: <NotificationWeatherPage />,
          },
          { path: 'settings/app-info', element: <AppInfoPage /> },
          {
            path: 'profile',
            element: <Navigate to="/settings/style-profile" replace />,
          },
          { path: '*', element: <Navigate to="/plan" replace /> },
        ],
      },
    ],
  },
])
