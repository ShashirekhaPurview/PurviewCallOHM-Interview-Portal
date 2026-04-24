import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConversation } from '@elevenlabs/react'
import {
  Maximize2,
  Minimize2,
  AlertTriangle,
  ShieldX,
  Clock,
  Wifi,
  XCircle,
  ChevronRight,
  Loader2,
  Bot,
  Volume2,
  CheckCircle2,
} from 'lucide-react'
import { getAgentSignedUrl } from '../apis/apiService'

const MAX_VIOLATIONS = 3

const PREVIEW_DYNAMIC_VARIABLE_KEYS = [
  'job_required_primary_skills',
  'job_title',
  'candidate_name',
  'candidate_summary',
  'candidate_skills',
  'candidate_current_role',
  'candidate_current_company',
  'candidate_years_of_experience',
  'candidate_education',
  'job_description',
  'job_requirements',
  'job_required_years_of_experience',
  'candidate_id',
  'job_id',
  'application_id',
  'job_salary_range',
]

const buildPreviewDynamicVariables = (sessionData) => {
  const actualValues = {
    candidate_name: sessionData?.candidateName || 'a',
    candidate_id: sessionData?.candidateId || 'a',
    application_id: sessionData?.applicationId || 'a',
    job_id: sessionData?.jobId || 'a',
  }

  return PREVIEW_DYNAMIC_VARIABLE_KEYS.reduce((acc, key) => {
    acc[key] = actualValues[key] || 'a'
    return acc
  }, {})
}

const getMessageRole = (message) => {
  const source = String(message?.source || message?.role || '').toLowerCase()
  return source.includes('user') || source.includes('human') ? 'user' : 'agent'
}

export default function Assessment({ sessionData }) {
  const navigate = useNavigate()

  const [elapsed, setElapsed] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [violations, setViolations] = useState(0)
  const [showExitModal, setShowExitModal] = useState(false)
  const [showViolation, setShowViolation] = useState(null)
  const [terminated, setTerminated] = useState(false)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [agentLoaded, setAgentLoaded] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [conversationHistory, setConversationHistory] = useState([])

  const containerRef = useRef(null)
  const toastTimerRef = useRef(null)
  const hasInitializedRef = useRef(false)
  const isStartingSessionRef = useRef(false)
  const intentionalStopRef = useRef(false)
  const voiceConvRef = useRef(null)
  const hasConnectedOnceRef = useRef(false)

  const voiceConv = useConversation({
    onConnect: () => {
      hasConnectedOnceRef.current = true
      setPreviewError('')
      setAgentLoaded(true)
    },
    onDisconnect: () => {
      isStartingSessionRef.current = false
      hasInitializedRef.current = false
      const wasIntentional = intentionalStopRef.current
      intentionalStopRef.current = false
      if (!wasIntentional && hasConnectedOnceRef.current) {
        setSessionEnded(true)
      }
    },
    onMessage: (message) => {
      const text = String(message?.message || '').trim()
      if (!text) return

      setConversationHistory((prev) => [
        ...prev,
        { role: getMessageRole(message), text },
      ])
    },
    onError: (error) => {
      isStartingSessionRef.current = false
      hasInitializedRef.current = false
      setPreviewError(typeof error === 'string' ? error : error?.message || 'Preview connection failed.')
      setAgentLoaded(true)
    },
  })

  const { status, isSpeaking } = voiceConv
  const isConnected = status === 'connected'
  const isConnecting = status === 'connecting'

  useEffect(() => {
    voiceConvRef.current = voiceConv
  }, [voiceConv])

  const formatTime = (s) => {
    const h = String(Math.floor(s / 3600)).padStart(2, '0')
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
    const sec = String(s % 60).padStart(2, '0')
    return `${h}:${m}:${sec}`
  }

  const raiseViolation = useCallback((type, msg) => {
    setViolations((prev) => {
      const next = prev + 1
      if (next >= MAX_VIOLATIONS) {
        setTerminated(true)
      }
      return next
    })

    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setShowViolation({ type, msg })
    toastTimerRef.current = setTimeout(() => setShowViolation(null), 5000)
  }, [])

  const startPreviewSession = useCallback(async ({ force = false } = {}) => {
    const conv = voiceConvRef.current
    if (!conv) return

    if (!force && (hasInitializedRef.current || isStartingSessionRef.current)) {
      return
    }

    if (!force && (conv.status === 'connected' || conv.status === 'connecting')) {
      hasInitializedRef.current = true
      return
    }

    isStartingSessionRef.current = true
    intentionalStopRef.current = false
    hasInitializedRef.current = true

    try {
      setPreviewError('')
      setConversationHistory([])
      setAgentLoaded(false)

      if (!window.isSecureContext) {
        throw new Error('Voice preview requires HTTPS or localhost.')
      }

      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access is not available in this browser context.')
      }

      const data = await getAgentSignedUrl()
      if (!data?.signed_url) {
        throw new Error('Signed URL was not returned for the preview session.')
      }

      await conv.startSession({
        signedUrl: data.signed_url,
        dynamicVariables: buildPreviewDynamicVariables(sessionData),
      })
    } catch (error) {
      hasInitializedRef.current = false
      setPreviewError(error?.message || 'Failed to start the preview session.')
      setAgentLoaded(true)
    } finally {
      isStartingSessionRef.current = false
    }
  }, [sessionData])

  const stopPreviewSession = useCallback(async () => {
    const conv = voiceConvRef.current
    if (!conv) return

    intentionalStopRef.current = true
    hasInitializedRef.current = false
    isStartingSessionRef.current = false

    try {
      if (conv.status === 'connected' || conv.status === 'connecting') {
        await conv.endSession()
      }
    } catch {
      // Ignore cleanup failures when the page is closing.
    }
  }, [])

  useEffect(() => {
    if (sessionEnded || terminated) return undefined
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [sessionEnded, terminated])

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = 'Your interview is in progress. Leaving will forfeit your session.'
      return e.returnValue
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !terminated && !sessionEnded) {
        raiseViolation('tab_switch', 'Tab switch detected! This activity has been flagged.')
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [raiseViolation, sessionEnded, terminated])

  useEffect(() => {
    const handleBlur = () => {
      if (!terminated && !sessionEnded) {
        raiseViolation('focus_loss', 'Window focus lost! Please stay in this window.')
      }
    }
    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [raiseViolation, sessionEnded, terminated])

  useEffect(() => {
    const handleFSChange = () => {
      const isFS = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement
      )
      setIsFullscreen(isFS)
      if (!isFS && agentLoaded && !terminated && !sessionEnded) {
        raiseViolation('fullscreen_exit', 'Fullscreen exited! Please return to fullscreen mode.')
      }
    }
    document.addEventListener('fullscreenchange', handleFSChange)
    document.addEventListener('webkitfullscreenchange', handleFSChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFSChange)
      document.removeEventListener('webkitfullscreenchange', handleFSChange)
    }
  }, [agentLoaded, sessionEnded, terminated, raiseViolation])

  useEffect(() => {
    const block = (e) => e.preventDefault()
    const blockKeys = (e) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) ||
        (e.ctrlKey && e.key === 'u') ||
        (e.ctrlKey && e.key === 'w')
      ) {
        e.preventDefault()
        raiseViolation('devtools', 'Developer tools usage is not permitted during the interview.')
      }
    }
    document.addEventListener('contextmenu', block)
    document.addEventListener('keydown', blockKeys)
    return () => {
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('keydown', blockKeys)
    }
  }, [raiseViolation])

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      if (containerRef.current?.requestFullscreen) {
        await containerRef.current.requestFullscreen().catch(() => {})
      }

      if (!cancelled) {
        await startPreviewSession()
      }
    }

    const timer = setTimeout(init, 600)

    return () => {
      cancelled = true
      clearTimeout(timer)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      stopPreviewSession()
    }
  }, [])

  useEffect(() => {
    if (!terminated) return
    stopPreviewSession()
  }, [terminated, stopPreviewSession])

  useEffect(() => {
    if (!sessionEnded) return
    stopPreviewSession()
  }, [sessionEnded, stopPreviewSession])

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen?.().catch(() => { })
    } else {
      document.exitFullscreen?.().catch(() => { })
    }
  }

  const handleExitRequest = () => setShowExitModal(true)

  const confirmExit = async () => {
    setShowExitModal(false)
    await stopPreviewSession()
    sessionStorage.removeItem('interview_session')
    navigate('/')
  }

  const handleRetryPreview = async () => {
    await stopPreviewSession()
    setSessionEnded(false)
    hasConnectedOnceRef.current = false
    await startPreviewSession({ force: true })
  }

  const violationColor =
    violations === 0 ? 'text-green-400' :
      violations === 1 ? 'text-yellow-400' :
        violations === 2 ? 'text-orange-400' : 'text-red-400'

  const handleTerminatedClose = async () => {
    await stopPreviewSession()
    sessionStorage.removeItem('interview_session')
    navigate('/')
  }

  const latestAgentMessage = [...conversationHistory].reverse().find((item) => item.role === 'agent')

  if (terminated) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-card-xl max-w-md w-full p-10 text-center animate-fade-up relative">
          <button
            onClick={handleTerminatedClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors duration-150"
            title="Close"
          >
            <XCircle size={18} />
          </button>

          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-5">
            <ShieldX size={28} className="text-red-500" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mb-2">Session Terminated</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Your session has been terminated due to multiple violations of the interview
            policy. This attempt has been recorded and the hiring team has been notified.
          </p>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-700 text-xs font-semibold">
              {violations} violation{violations !== 1 ? 's' : ''} recorded
            </p>
          </div>
          <p className="text-slate-400 text-xs">
            If you believe this is an error, please contact{' '}
            <a href="mailto:support@purviewcallohm.com" className="text-accent hover:underline font-medium">
              support@purviewcallohm.com
            </a>
          </p>
        </div>
      </div>
    )
  }

  if (sessionEnded) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-card-xl max-w-md w-full p-10 text-center animate-fade-up relative">
          <button
            onClick={handleTerminatedClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors duration-150"
            title="Close"
          >
            <XCircle size={18} />
          </button>

          <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={28} className="text-green-600" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mb-2">Interview Completed</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Your AI interview session has ended successfully. Your responses have been captured
            and shared with the hiring team for review.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <p className="text-green-700 text-xs font-semibold">
              Session duration: {formatTime(elapsed)}
            </p>
          </div>
          <p className="text-slate-400 text-xs mb-6">
            You can close this window now. If the recruiter needs anything else, they will contact you.
          </p>
          <button
            onClick={handleTerminatedClose}
            className="w-full py-3 rounded-xl bg-navy-800 hover:bg-navy-700 font-semibold text-sm text-white transition-all duration-150"
          >
            Close Session
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col bg-navy-950 text-white"
      style={{ height: '100vh', overflow: 'hidden' }}
    >
      <header className="flex-shrink-0 flex items-center justify-between px-5 py-2.5 bg-navy-900 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center font-extrabold text-white text-xs">
              P
            </div>
            <span className="font-semibold text-sm hidden sm:inline text-white/90 tracking-tight">
              Purview Callohm
            </span>
          </div>

          <div className="h-4 w-px bg-white/15 hidden sm:block" />

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-400/25">
            <span className="live-dot" />
            <span className="text-red-300 text-xs font-semibold tracking-wide">LIVE</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-5 text-xs text-white/60 font-medium">
          <span className="text-white/80 font-semibold">{sessionData.candidateName}</span>
          <span className="w-px h-3 bg-white/20" />
          <span className="flex items-center gap-1.5">
            <Wifi size={12} />
            {sessionData.applicationId}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={12} />
            {formatTime(elapsed)}
          </span>
          <span className={`flex items-center gap-1 font-semibold ${violationColor}`}>
            <ShieldX size={12} />
            {violations}/{MAX_VIOLATIONS} violations
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="md:hidden text-xs text-white/60 font-mono font-medium">
            {formatTime(elapsed)}
          </span>

          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="w-8 h-8 rounded-lg bg-white/8 hover:bg-white/15 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors duration-150"
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          <button
            onClick={handleExitRequest}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-400/25 text-red-300 hover:text-red-200 text-xs font-semibold transition-colors duration-150"
          >
            <XCircle size={13} />
            <span className="hidden sm:inline">End Session</span>
          </button>
        </div>
      </header>

      <div className="flex-1 relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_35%),linear-gradient(180deg,#081225_0%,#020817_100%)]">
        {!agentLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-navy-950 z-20 gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-white/10 border-t-white/70 animate-spin" />
            <p className="text-white/50 text-sm">Connecting to interviewer...</p>
          </div>
        )}

        <div className="h-full flex items-center justify-center px-6 py-8">
            <div className="w-full max-w-3xl rounded-[32px] border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_30px_120px_rgba(2,6,23,0.55)] px-6 py-8 sm:px-10 sm:py-10">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-8">
                  <div className={`absolute inset-0 rounded-full blur-3xl transition-opacity duration-500 ${isConnected ? 'opacity-100' : 'opacity-50'}`} style={{ background: isSpeaking ? 'rgba(59,130,246,0.5)' : 'rgba(148,163,184,0.25)' }} />
                  <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-full border border-white/15 bg-white/[0.06] flex items-center justify-center shadow-[0_0_80px_rgba(59,130,246,0.15)]">
                    {isConnecting ? (
                      <Loader2 size={42} className="animate-spin text-blue-300" />
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isSpeaking ? 'bg-blue-500/20 text-blue-200' : 'bg-white/10 text-white/80'}`}>
                          {isSpeaking ? <Volume2 size={28} /> : <Bot size={28} />}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? (isSpeaking ? 'bg-blue-400 animate-pulse' : 'bg-emerald-400 animate-pulse') : previewError ? 'bg-red-400' : 'bg-white/30'}`} />
                          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
                            {isConnected ? (isSpeaking ? 'Speaking' : 'Listening') : previewError ? 'Disconnected' : 'Preparing'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-xs uppercase tracking-[0.28em] text-blue-200/70 font-semibold mb-3">
                  Round 2 Interviewer
                </p>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
                  AI Interview Session In Progress
                </h1>
                <p className="max-w-2xl text-sm sm:text-base text-white/65 leading-relaxed">
                  Stay in fullscreen, keep your microphone active, and respond naturally. The agent will collect the remaining details during the conversation.
                </p>

                <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 text-left">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/45 font-semibold mb-2">
                      Candidate
                    </p>
                    <p className="text-base font-semibold text-white">{sessionData.candidateName}</p>
                    <p className="text-sm text-white/55 mt-1">{sessionData.candidateId}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 text-left">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/45 font-semibold mb-2">
                      Session
                    </p>
                    <p className="text-base font-semibold text-white">{sessionData.applicationId}</p>
                    <p className="text-sm text-white/55 mt-1">{sessionData.jobId}</p>
                  </div>
                </div>

                {previewError && (
                  <div className="mt-8 w-full max-w-2xl rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-4 text-left">
                    <p className="text-sm font-semibold text-red-200">Preview connection failed</p>
                    <p className="text-sm text-red-100/80 mt-1">{previewError}</p>
                    <button
                      onClick={handleRetryPreview}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white text-slate-900 px-4 py-2 text-sm font-semibold hover:bg-slate-100 transition-colors"
                    >
                      Retry Connection
                    </button>
                  </div>
                )}

                {!previewError && latestAgentMessage && (
                  <div className="mt-8 w-full max-w-2xl rounded-2xl border border-blue-400/15 bg-blue-500/10 px-4 py-4 text-left">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-blue-200/75 font-semibold mb-2">
                      Latest Agent Prompt
                    </p>
                    <p className="text-sm text-white/85 leading-relaxed">{latestAgentMessage.text}</p>
                  </div>
                )}
              </div>
            </div>
        </div>
      </div>

      {showViolation && (
        <div className="fixed top-16 right-4 z-50 animate-slide-right">
          <div className="flex items-start gap-3 bg-white rounded-xl shadow-card-xl border-l-4 border-orange-400 p-4 max-w-sm">
            <AlertTriangle size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-800">Violation Detected</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                {showViolation.msg}
              </p>
              <p className="text-xs font-semibold text-orange-600 mt-1.5">
                {violations}/{MAX_VIOLATIONS} warnings - session ends at {MAX_VIOLATIONS}
              </p>
            </div>
          </div>
        </div>
      )}

      {!isFullscreen && agentLoaded && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-amber-500 text-amber-950 py-2.5 px-5 flex items-center justify-between text-sm font-semibold">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            Please enter fullscreen mode to continue your interview.
          </div>
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1 bg-amber-900/20 hover:bg-amber-900/30 rounded-lg px-3 py-1 text-xs transition-colors"
          >
            Go Fullscreen <ChevronRight size={13} />
          </button>
        </div>
      )}

      {showExitModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-card-xl max-w-md w-full p-8 animate-fade-up">
            <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-5">
              <AlertTriangle size={24} className="text-red-500" />
            </div>

            <h3 className="text-xl font-extrabold text-slate-900 text-center mb-2 tracking-tight">
              End Your Interview?
            </h3>
            <p className="text-slate-500 text-sm text-center leading-relaxed mb-6">
              Ending the session early will <span className="font-semibold text-slate-700">permanently close</span> this
              interview link. Since each link is single-use, you will
              <span className="font-semibold text-red-600"> not be able to restart</span>.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-6 flex items-start gap-2.5">
              <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                The hiring team will be notified of an early termination. Only proceed
                if you are absolutely certain.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowExitModal(false)}
                className="flex-1 py-3 rounded-xl border-2 border-slate-200 font-semibold text-sm text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150"
              >
                Continue Interview
              </button>
              <button
                onClick={confirmExit}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 font-semibold text-sm text-white transition-all duration-150 hover:shadow-[0_4px_14px_-4px_rgba(239,68,68,0.5)]"
              >
                Yes, End Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
