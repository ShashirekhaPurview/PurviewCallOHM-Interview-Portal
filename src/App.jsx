import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import ApplicationEntry from './pages/ApplicationEntry'
import Instructions from './pages/Instructions'
import Assessment from './pages/Assessment'
import SessionExpired from './pages/SessionExpired'
import SessionComplete from './pages/SessionComplete'

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
              ? <Assessment sessionData={sessionData} />
              : sessionData?.validated
              ? <Navigate to="/instructions" replace />
              : <Navigate to="/" replace />
          }
        />
        <Route path="/session-expired" element={<SessionExpired />} />
        <Route path="/session-complete" element={<SessionComplete />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
