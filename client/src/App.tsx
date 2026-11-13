import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { ViewerProvider } from './context/ViewerProvider'
import Account from './pages/Account'
import AuthConfirm from './pages/AuthConfirm'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Matching from './pages/Matching'
import Messages from './pages/Messages'
import Profile from './pages/Profile'
import ResetPassword from './pages/ResetPassword'
import Schedule from './pages/Schedule'

export default function App() {
  return (
    <AuthProvider>
      <ViewerProvider>
      <BrowserRouter>
        <Routes>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/auth/confirm" element={<AuthConfirm />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<Dashboard />} />
            <Route
              path="matching"
              element={
                <ProtectedRoute roles={['student', 'mentor', 'admin']}>
                  <Matching />
                </ProtectedRoute>
              }
            />
            <Route
              path="schedule"
              element={
                <ProtectedRoute roles={['student', 'mentor', 'admin']}>
                  <Schedule />
                </ProtectedRoute>
              }
            />
            <Route
              path="messages"
              element={
                <ProtectedRoute roles={['student', 'mentor', 'admin']}>
                  <Messages />
                </ProtectedRoute>
              }
            />
            <Route path="profile" element={<Profile />} />
            <Route path="account" element={<Account />} />
            {/* The old manual-matching page is now the Matches tab of the admin dashboard. */}
            <Route path="admin" element={<Navigate to="/dashboard?tab=matches" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </ViewerProvider>
    </AuthProvider>
  )
}
