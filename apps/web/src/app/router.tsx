import { Suspense } from 'react'
import {
  Navigate,
  createBrowserRouter,
  createHashRouter,
} from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import {
  ClosetRouteSkeleton,
  LookbookRouteSkeleton,
  PlanRouteSkeleton,
  SettingsRouteSkeleton,
  StyleProfileRouteSkeleton,
} from '../components/layout/TabRouteSkeleton'
import { RequireAuth } from '../features/auth/components/RequireAuth'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { ClosetDetailPage } from '../features/closet/pages/ClosetDetailPage'
import { WardrobeRediscoveryPage } from '../features/closet/pages/WardrobeRediscoveryPage'
import { OutfitComposerPage } from '../features/lookbook/pages/OutfitComposerPage'
import { PlanDetailPage } from '../features/plan/pages/PlanDetailPage'
import { AppInfoPage } from '../features/settings/pages/AppInfoPage'
import { AccountSettingsPage } from '../features/settings/pages/AccountSettingsPage'
import { WardrobeStatisticsPage } from '../features/settings/pages/WardrobeStatisticsPage'
import { NotificationsPage } from '../features/settings/pages/NotificationsPage'
import { WeatherLocationPage } from '../features/settings/pages/WeatherLocationPage'
import { WearReminderSettingsPage } from '../features/settings/pages/WearReminderSettingsPage'
import { isNativeWebViewRuntime } from '../native-bridge'
import { WearHistoryPage } from '../features/wear-history/pages/WearHistoryPage'
import {
  ClosetPage,
  LookbookPage,
  PlanPage,
  SettingsPage,
  StyleProfilePage,
} from './LazyTabPages'

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
          {
            path: 'plan',
            element: <Suspense fallback={<PlanRouteSkeleton />}><PlanPage /></Suspense>,
          },
          { path: 'plan/:date', element: <PlanDetailPage /> },
          {
            path: 'plan/:date/item/:itemId',
            element: <ClosetDetailPage />,
          },
          {
            path: 'closet',
            element: <Suspense fallback={<ClosetRouteSkeleton />}><ClosetPage /></Suspense>,
            children: [{ path: ':itemId', element: <ClosetDetailPage /> }],
          },
          { path: 'closet/rediscovery', element: <WardrobeRediscoveryPage /> },
          {
            path: 'lookbook',
            element: <Suspense fallback={<LookbookRouteSkeleton />}><LookbookPage /></Suspense>,
          },
          { path: 'lookbook/new', element: <OutfitComposerPage /> },
          { path: 'wear-history', element: <WearHistoryPage /> },
          { path: 'recommend', element: <Navigate to="/lookbook" replace /> },
          {
            path: 'settings',
            element: <Suspense fallback={<SettingsRouteSkeleton />}><SettingsPage /></Suspense>,
          },
          { path: 'settings/statistics', element: <WardrobeStatisticsPage /> },
          {
            path: 'settings/style-profile',
            element: <Suspense fallback={<StyleProfileRouteSkeleton />}><StyleProfilePage /></Suspense>,
          },
          {
            path: 'settings/wear-reminder',
            element: <WearReminderSettingsPage />,
          },
          {
            path: 'settings/notifications-weather',
            element: <Navigate to="/settings/notifications" replace />,
          },
          { path: 'settings/notifications', element: <NotificationsPage /> },
          { path: 'settings/weather-location', element: <WeatherLocationPage /> },
          { path: 'settings/app-info', element: <AppInfoPage /> },
          { path: 'settings/account', element: <AccountSettingsPage /> },
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
