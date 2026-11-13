import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import Account from './pages/Account'
import Admin from './pages/Admin'
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
                <ProtectedRoute roles={['student', 'mentor']}>
                  <Matching />
                </ProtectedRoute>
              }
            />
            <Route
              path="schedule"
              element={
                <ProtectedRoute roles={['student', 'mentor']}>
                  <Schedule />
                </ProtectedRoute>
              }
            />
            <Route
              path="messages"
              element={
                <ProtectedRoute roles={['student', 'mentor']}>
                  <Messages />
                </ProtectedRoute>
              }
            />
            <Route path="profile" element={<Profile />} />
            <Route path="account" element={<Account />} />
            <Route
              path="admin"
              element={
                <ProtectedRoute roles={['admin']}>
                  <Admin />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
