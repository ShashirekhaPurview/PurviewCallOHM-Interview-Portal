import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, lazy, Suspense } from 'react'
import ApplicationEntry from './pages/ApplicationEntry'
import Instructions from './pages/Instructions'
import SessionExpired from './pages/SessionExpired'

const Assessment = lazy(() => import('./pages/Assessment'))

export default function App() {
  const [sessionData, setSessionData] = useState(() => {
    try {
      const saved = sessionStorage.getItem('interview_session')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const updateSession = (data) => {
    setSessionData(data)
    if (data) {
      sessionStorage.setItem('interview_session', JSON.stringify(data))
    } else {
      sessionStorage.removeItem('interview_session')
    }
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<ApplicationEntry onValidated={updateSession} />}
        />
        <Route
          path="/instructions"
          element={
            sessionData?.validated
              ? <Instructions sessionData={sessionData} onStart={updateSession} />
              : <Navigate to="/" replace />
          }
        />
        <Route
          path="/assessment"
          element={
            sessionData?.started
              ? (
                <Suspense fallback={
                  <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full border-4 border-white/10 border-t-white/70 animate-spin" />
                  </div>
                }>
                  <Assessment sessionData={sessionData} />
                </Suspense>
              )
              : sessionData?.validated
              ? <Navigate to="/instructions" replace />
              : <Navigate to="/" replace />
          }
        />
        <Route path="/session-expired" element={<SessionExpired />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
