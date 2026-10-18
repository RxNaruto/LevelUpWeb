import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router'
import { useAuth } from './auth/useAuth'
import { BrandSplash } from './components/BrandSplash'
import { TabBar } from './components/TabBar'
import { LoadingState, Screen } from './components/ui'
import { Login, Register } from './pages/Auth'
import Home from './pages/Home'
import Today from './pages/Today'

const Tasks = lazy(() => import('./pages/Tasks'))
const TaskEditor = lazy(() => import('./pages/TaskEditor'))
const Projects = lazy(() => import('./pages/Projects'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const Connections = lazy(() => import('./pages/Connections'))
const History = lazy(() => import('./pages/History'))
const Settings = lazy(() => import('./pages/Settings'))

function PageFallback() {
  return (
    <Screen>
      <LoadingState fullScreen />
    </Screen>
  )
}

function AppShell() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <BrandSplash />
  if (status === 'anonymous') {
    if (location.pathname === '/') {
      return (
        <div className="app">
          <Home />
        </div>
      )
    }
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return (
    <div className="app app--tabs">
      <TabBar />
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </div>
  )
}

function PublicShell() {
  const { status } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  if (status === 'loading') return <BrandSplash />
  if (status === 'authenticated') return <Navigate to={from && from !== '/login' ? from : '/'} replace />

  return (
    <div className="app">
      <Outlet />
    </div>
  )
}

const router = createBrowserRouter([
  {
    element: <PublicShell />,
    children: [
      { path: '/login', element: <Login /> },
      { path: '/register', element: <Register /> },
    ],
  },
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Today /> },
      { path: '/tasks', element: <Tasks /> },
      { path: '/tasks/new', element: <TaskEditor /> },
      { path: '/tasks/:id', element: <TaskEditor /> },
      { path: '/projects', element: <Projects /> },
      { path: '/projects/:id', element: <ProjectDetail /> },
      { path: '/apps', element: <Connections /> },
      { path: '/history', element: <History /> },
      { path: '/settings', element: <Settings /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
