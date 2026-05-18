import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConversation } from '@elevenlabs/react'
import {
  Maximize2, Minimize2, AlertTriangle, ShieldX,
  Clock, Wifi, XCircle, ChevronRight, Loader2,
  Bot, Volume2, CheckCircle2, VideoOff,
} from 'lucide-react'
import { getAgentSignedUrl, reportTermination } from '../apis/apiService'

const MAX_VIOLATIONS = 3

const PREVIEW_DYNAMIC_VARIABLE_KEYS = [
  'job_required_primary_skills', 'job_title', 'candidate_name',
  'candidate_summary', 'candidate_skills', 'candidate_current_role',
  'candidate_current_company', 'candidate_years_of_experience',
  'candidate_education', 'job_description', 'job_requirements',
  'job_required_years_of_experience', 'candidate_id', 'job_id',
  'application_id', 'job_salary_range',
]

const buildPreviewDynamicVariables = (sessionData) => {
  const actualValues = {
    candidate_name:   sessionData?.candidateName  || 'a',
    candidate_id:     sessionData?.candidateId    || 'a',
    application_id:   sessionData?.applicationId  || 'a',
    job_id:           sessionData?.jobId          || 'a',
  }
  return PREVIEW_DYNAMIC_VARIABLE_KEYS.reduce((acc, key) => {
    acc[key] = actualValues[key] || 'a'
    return acc
  }, {})
}


// ─── Agent Visual ─────────────────────────────────────────────────────────────
function AgentVisual({ isSpeaking, isConnecting, isMain }) {
  const initials = 'AL'
  return (
    <div className="w-full h-full flex items-center justify-center
                    bg-gradient-to-b from-[#0d1b3e] via-[#091428] to-[#020817] relative overflow-hidden">
      {/* Ambient glow */}
      <div className={`absolute inset-0 transition-opacity duration-700 pointer-events-none
                       ${isSpeaking ? 'opacity-100' : 'opacity-30'}`}
           style={{ background: 'radial-gradient(circle at 50% 45%, rgba(59,130,246,0.25), transparent 65%)' }} />

      {isMain ? (
        /* Main view — large orb */
        <div className="flex flex-col items-center gap-4 relative z-10">
          {/* Outer pulse ring */}
          <div className="relative">
            {isSpeaking && (
              <>
                <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping scale-125" />
                <div className="absolute inset-0 rounded-full bg-blue-400/10 animate-ping scale-150"
                     style={{ animationDelay: '0.2s' }} />
              </>
            )}
            <div className={`relative w-36 h-36 sm:w-44 sm:h-44 rounded-full border-2
                             flex items-center justify-center transition-all duration-500
                             ${isSpeaking
                               ? 'border-blue-400/60 bg-blue-500/15 shadow-[0_0_60px_rgba(59,130,246,0.35)]'
                               : 'border-white/15 bg-white/[0.06]'}`}>
              {isConnecting ? (
                <Loader2 size={40} className="text-blue-300 animate-spin" />
              ) : (
                <span className="text-5xl font-extrabold text-white/80 tracking-tight select-none">
                  {initials}
                </span>
              )}
            </div>
          </div>
          {/* Name & status */}
          <div className="text-center">
            <p className="text-white font-bold text-lg tracking-tight">Aliya</p>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <span className={`w-2 h-2 rounded-full transition-colors duration-300
                               ${isConnecting ? 'bg-yellow-400 animate-pulse'
                                 : isSpeaking  ? 'bg-blue-400 animate-pulse'
                                 : 'bg-emerald-400 animate-pulse'}`} />
              <span className="text-xs text-white/55 font-medium uppercase tracking-widest">
                {isConnecting ? 'Connecting' : isSpeaking ? 'Speaking' : 'Listening'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* PiP view — compact */
        <div className="flex flex-col items-center justify-center gap-1.5 w-full h-full">
          <div className={`w-12 h-12 rounded-full border flex items-center justify-center
                           transition-all duration-300
                           ${isSpeaking ? 'border-blue-400/60 bg-blue-500/20' : 'border-white/20 bg-white/10'}`}>
            {isConnecting
              ? <Loader2 size={18} className="text-blue-300 animate-spin" />
              : isSpeaking
              ? <Volume2 size={18} className="text-blue-300" />
              : <Bot size={18} className="text-white/70" />}
          </div>
          <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wide">
            Aliya
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Candidate Video ──────────────────────────────────────────────────────────
function CandidateView({ videoRef, cameraError, candidateName, isMain }) {
  const initial = candidateName?.[0]?.toUpperCase() || 'C'
  return (
    <div className="w-full h-full relative bg-slate-900 overflow-hidden">
      {/* Camera feed — always rendered so stream stays active */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />
      {/* Fallback when camera is unavailable */}
      {cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center
                        bg-gradient-to-b from-slate-800 to-slate-900 gap-3">
          {isMain
            ? <>
                <div className="w-24 h-24 rounded-full bg-slate-700 border-2 border-slate-600
                                flex items-center justify-center">
                  <span className="text-4xl font-extrabold text-white/60">{initial}</span>
                </div>
                <p className="text-white/40 text-sm font-medium">{candidateName}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <VideoOff size={12} className="text-white/30" />
                  <span className="text-white/30 text-xs">Camera unavailable</span>
                </div>
              </>
            : <span className="text-2xl font-extrabold text-white/50">{initial}</span>
          }
        </div>
      )}
      {/* Name label (main view only) */}
      {isMain && (
        <div className="absolute bottom-4 left-4 z-10">
          <span className="text-xs font-semibold text-white bg-black/50 backdrop-blur-sm
                           px-2.5 py-1 rounded-lg">
            {candidateName} (You)
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Assessment({ sessionData }) {
  const navigate = useNavigate()

  const [elapsed, setElapsed]             = useState(0)
  const [isFullscreen, setIsFullscreen]   = useState(false)
  const [violations, setViolations]       = useState(0)
  const [showExitModal, setShowExitModal] = useState(false)
  const [showViolation, setShowViolation] = useState(null)
  const [terminated, setTerminated]       = useState(false)
  const [sessionEnded, setSessionEnded]   = useState(false)
  const [agentLoaded, setAgentLoaded]     = useState(false)
  const [previewError, setPreviewError]   = useState('')
  const [cameraError, setCameraError]     = useState(false)
  const [devToolsOpen, setDevToolsOpen]   = useState(false)
  const [fullscreenGate, setFullscreenGate] = useState(
    () => !(document.fullscreenElement || document.webkitFullscreenElement)
  )

  const containerRef        = useRef(null)
  const toastTimerRef       = useRef(null)
  const hasInitializedRef   = useRef(false)
  const isStartingSessionRef = useRef(false)
  const intentionalStopRef  = useRef(false)
  const voiceConvRef        = useRef(null)
  const hasConnectedOnceRef = useRef(false)
  const videoPipRef             = useRef(null)
  const streamRef               = useRef(null)
  const lastViolationTimeRef    = useRef(0)

  // ── Camera ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        streamRef.current = stream
        if (videoPipRef.current) videoPipRef.current.srcObject = stream
      } catch {
        setCameraError(true)
      }
    }
    startCamera()
    return () => streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  // ── ElevenLabs voice conversation ──────────────────────────────────────────
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
      if (!wasIntentional && hasConnectedOnceRef.current) setSessionEnded(true)
    },
    onMessage: () => {},
    onError: (error) => {
      isStartingSessionRef.current = false
      hasInitializedRef.current = false
      setPreviewError(typeof error === 'string' ? error : error?.message || 'Preview connection failed.')
      setAgentLoaded(true)
    },
  })

  const { status, isSpeaking } = voiceConv
  const isConnecting = status === 'connecting'

  useEffect(() => { voiceConvRef.current = voiceConv }, [voiceConv])

  const formatTime = (s) => {
    const h   = String(Math.floor(s / 3600)).padStart(2, '0')
    const m   = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
    const sec = String(s % 60).padStart(2, '0')
    return `${h}:${m}:${sec}`
  }

  const raiseViolation = useCallback((type, msg) => {
    const now = Date.now()
    if (now - lastViolationTimeRef.current < 1000) return
    lastViolationTimeRef.current = now
    setViolations(prev => {
      const next = prev + 1
      if (next >= MAX_VIOLATIONS) setTerminated(true)
      return next
    })
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setShowViolation({ type, msg })
    toastTimerRef.current = setTimeout(() => setShowViolation(null), 5000)
  }, [])

  const startPreviewSession = useCallback(async ({ force = false } = {}) => {
    const conv = voiceConvRef.current
    if (!conv) return
    if (!force && (hasInitializedRef.current || isStartingSessionRef.current)) return
    if (!force && (conv.status === 'connected' || conv.status === 'connecting')) {
      hasInitializedRef.current = true; return
    }
    isStartingSessionRef.current = true
    intentionalStopRef.current   = false
    hasInitializedRef.current    = true
    try {
      setPreviewError('')
      setAgentLoaded(false)
      if (!window.isSecureContext) throw new Error('Voice preview requires HTTPS or localhost.')
      if (!navigator?.mediaDevices?.getUserMedia) throw new Error('Microphone access is not available.')
      const data = await Promise.resolve(getAgentSignedUrl())
      if (!data?.signed_url) throw new Error('Signed URL was not returned.')
      await conv.startSession({ signedUrl: data.signed_url, dynamicVariables: buildPreviewDynamicVariables(sessionData) })
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
    intentionalStopRef.current   = true
    hasInitializedRef.current    = false
    isStartingSessionRef.current = false
    try {
      if (conv.status === 'connected' || conv.status === 'connecting') await conv.endSession()
    } catch { /* ignore cleanup failures */ }
  }, [])

  // ── Timers & event guards ───────────────────────────────────────────────────
  useEffect(() => {
    if (sessionEnded || terminated) return
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [sessionEnded, terminated])

  useEffect(() => {
    const h = (e) => { e.preventDefault(); e.returnValue = 'Interview in progress.'; return e.returnValue }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [])

  useEffect(() => {
    const h = () => { if (document.hidden && agentLoaded && !terminated && !sessionEnded) raiseViolation('tab_switch', 'You switched away from this tab. Return to this window immediately — leaving this tab is a violation and may close your interview.') }
    document.addEventListener('visibilitychange', h)
    return () => document.removeEventListener('visibilitychange', h)
  }, [raiseViolation, agentLoaded, sessionEnded, terminated])

  useEffect(() => {
    const h = () => { if (agentLoaded && !terminated && !sessionEnded) raiseViolation('focus_loss', 'You moved away from this window. Return to the interview immediately — switching to another window or screen is a violation and may close your interview.') }
    window.addEventListener('blur', h)
    return () => window.removeEventListener('blur', h)
  }, [raiseViolation, agentLoaded, sessionEnded, terminated])

  // Poll document.hasFocus() to catch multi-monitor window switches that don't always fire blur
  useEffect(() => {
    if (!agentLoaded || terminated || sessionEnded) return
    const id = setInterval(() => {
      if (!document.hasFocus() && agentLoaded && !terminated && !sessionEnded) {
        raiseViolation('focus_loss', 'You moved away from this window. Return to the interview immediately — switching to another window or screen is a violation and may close your interview.')
      }
    }, 1000)
    return () => clearInterval(id)
  }, [raiseViolation, agentLoaded, terminated, sessionEnded])

  useEffect(() => {
    const h = () => {
      const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement)
      setIsFullscreen(isFS)
      if (!isFS && agentLoaded && !terminated && !sessionEnded) raiseViolation('fullscreen_exit', 'You exited fullscreen mode. Click the fullscreen button to return — continuing outside fullscreen is a violation and may close your interview.')
    }
    document.addEventListener('fullscreenchange', h)
    document.addEventListener('webkitfullscreenchange', h)
    return () => { document.removeEventListener('fullscreenchange', h); document.removeEventListener('webkitfullscreenchange', h) }
  }, [agentLoaded, sessionEnded, terminated, raiseViolation])

  useEffect(() => {
    const block = e => e.preventDefault()
    const blockKeys = e => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) || (e.ctrlKey && e.key === 'u') || (e.ctrlKey && e.key === 'w')) {
        e.preventDefault()
        raiseViolation('devtools', 'Developer tools usage is not permitted during the interview.')
      }
    }
    document.addEventListener('contextmenu', block)
    document.addEventListener('keydown', blockKeys)
    return () => { document.removeEventListener('contextmenu', block); document.removeEventListener('keydown', blockKeys) }
  }, [raiseViolation])

  // ── DevTools open detection (window-size heuristic) ────────────────────────
  useEffect(() => {
    const devToolsOpenRef = { current: false }
    const THRESHOLD = 160

    const check = () => {
      const isOpen =
        window.outerWidth  - window.innerWidth  > THRESHOLD ||
        window.outerHeight - window.innerHeight > THRESHOLD
      setDevToolsOpen(isOpen)
      if (isOpen && !devToolsOpenRef.current) {
        devToolsOpenRef.current = true
        if (!terminated && !sessionEnded)
          raiseViolation('devtools_open', 'Browser DevTools is open. Please close it to continue.')
      } else if (!isOpen) {
        devToolsOpenRef.current = false
      }
    }

    check()
    const id = setInterval(check, 2000)
    return () => clearInterval(id)
  }, [raiseViolation, terminated, sessionEnded])

  useEffect(() => {
    // If arriving from Instructions already in fullscreen, skip gate and start immediately
    const alreadyFS = !!(document.fullscreenElement || document.webkitFullscreenElement)
    if (alreadyFS) {
      setFullscreenGate(false)
      startPreviewSession()
    }
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); stopPreviewSession() }
  }, [])

  const handleEnterFullscreen = useCallback(async () => {
    try { await containerRef.current?.requestFullscreen() } catch { /* user or browser denied */ }
    setFullscreenGate(false)
    await startPreviewSession()
  }, [startPreviewSession])

  useEffect(() => {
    if (!terminated) return
    stopPreviewSession()
    reportTermination(sessionData?.applicationId).catch(() => {})
  }, [terminated, stopPreviewSession])
  useEffect(() => { if (sessionEnded) stopPreviewSession() }, [sessionEnded, stopPreviewSession])

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const toggleFullscreen = () => {
    if (!isFullscreen) containerRef.current?.requestFullscreen?.().catch(() => {})
    else               document.exitFullscreen?.().catch(() => {})
  }

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

  const handleTerminatedClose = async () => {
    await stopPreviewSession()
    sessionStorage.removeItem('interview_session')
    navigate('/')
  }

  const violationColor =
    violations === 0 ? 'text-green-400' :
    violations === 1 ? 'text-yellow-400' :
    violations === 2 ? 'text-orange-400' : 'text-red-400'

  // Agent (Aliya) is always the main full-screen view; candidate is always PiP

  // ── Terminated screen ────────────────────────────────────────────────────────
  if (terminated) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-card-xl max-w-md w-full p-10 text-center animate-fade-up relative">
          <button onClick={handleTerminatedClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200
                       flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors">
            <XCircle size={18} />
          </button>
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-5">
            <ShieldX size={28} className="text-red-500" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mb-2">Session Terminated</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Your session has been terminated due to multiple violations of the interview policy.
            This attempt has been recorded and the hiring team has been notified.
          </p>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-700 text-xs font-semibold">
              {violations} violation{violations !== 1 ? 's' : ''} recorded
            </p>
          </div>
          <p className="text-slate-400 text-xs">
            If you believe this is an error, contact{' '}
            <a href="mailto:support@purviewcallohm.com" className="text-accent hover:underline font-medium">
              support@purviewcallohm.com
            </a>
          </p>
        </div>
      </div>
    )
  }

  // ── Session ended screen ─────────────────────────────────────────────────────
  if (sessionEnded) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-card-xl max-w-md w-full p-10 text-center animate-fade-up relative">
          <button onClick={handleTerminatedClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200
                       flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors">
            <XCircle size={18} />
          </button>
          <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={28} className="text-green-600" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mb-2">Interview Completed</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Your AI interview session has ended successfully. Your responses have been captured and shared with the hiring team.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <p className="text-green-700 text-xs font-semibold">Session duration: {formatTime(elapsed)}</p>
          </div>
          <p className="text-slate-400 text-xs mb-6">
            You can close this window. The recruiter will contact you if anything else is needed.
          </p>
          <button onClick={handleTerminatedClose}
            className="w-full py-3 rounded-xl bg-navy-800 hover:bg-navy-700 font-semibold text-sm text-white transition-all">
            Close Session
          </button>
        </div>
      </div>
    )
  }

  // ── Assessment UI ────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="flex flex-col bg-black text-white"
         style={{ height: '100vh', overflow: 'hidden' }}>

      {/* ── Fullscreen Gate — blocks entry until user explicitly enters fullscreen ── */}
      {fullscreenGate && (
        <div className="fixed inset-0 bg-[#020817] z-[9999] flex flex-col items-center justify-center gap-6 p-8">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center">
            <Maximize2 size={32} className="text-blue-400" />
          </div>
          <div className="text-center max-w-sm">
            <h2 className="text-white text-xl font-extrabold mb-2 tracking-tight">Fullscreen Required</h2>
            <p className="text-white/60 text-sm leading-relaxed">
              Your interview must be conducted in fullscreen mode. Click below to enter fullscreen and begin.
              Exiting fullscreen at any point will be recorded as a violation.
            </p>
          </div>
          <button onClick={handleEnterFullscreen}
            className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500
                       text-white font-semibold text-sm transition-all shadow-lg hover:shadow-blue-500/30">
            <Maximize2 size={18} />
            Enter Fullscreen &amp; Start Interview
          </button>
          <p className="text-white/30 text-xs text-center max-w-xs">
            Switching to another window or monitor during the interview will also be flagged.
          </p>
        </div>
      )}

      {/* ── Top Info Bar ───────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center justify-between
                         px-5 py-2.5 bg-black/80 backdrop-blur-sm border-b border-white/10 z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="/callohm-logo.png" alt="Callohm" className="h-7 w-auto object-contain" />
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
          <span className="flex items-center gap-1.5"><Wifi size={12} />{sessionData.applicationId}</span>
          <span className="flex items-center gap-1.5"><Clock size={12} />{formatTime(elapsed)}</span>
          <span className={`flex items-center gap-1 font-semibold ${violationColor}`}>
            <ShieldX size={12} />{violations}/{MAX_VIOLATIONS} violations
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="md:hidden text-xs text-white/60 font-mono">{formatTime(elapsed)}</span>
          <button onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="w-8 h-8 rounded-lg bg-white/8 hover:bg-white/15 border border-white/10
                       flex items-center justify-center text-white/70 hover:text-white transition-colors">
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button onClick={() => setShowExitModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                       bg-red-500/15 hover:bg-red-500/25 border border-red-400/25
                       text-red-300 hover:text-red-200 text-xs font-semibold transition-colors">
            <XCircle size={13} />
            <span className="hidden sm:inline">End Session</span>
          </button>
        </div>
      </header>

      {/* ── Video Call Area ─────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden bg-black">

        {/* Loading overlay */}
        {!agentLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center
                          bg-[#020817] z-50 gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-white/10 border-t-white/70 animate-spin" />
            <p className="text-white/50 text-sm">Connecting to interviewer…</p>
          </div>
        )}

        {/* ── MAIN VIEW — Aliya (always full-screen) ────────────────────── */}
        <div className="absolute inset-0 z-10">
          <AgentVisual isSpeaking={isSpeaking} isConnecting={isConnecting} isMain={true} />
          <div className="absolute bottom-24 left-5 z-10">
            <span className="text-xs font-semibold text-white bg-black/50 backdrop-blur-sm
                             px-2.5 py-1 rounded-lg">
              Aliya
            </span>
          </div>
        </div>

        {/* ── PiP WINDOW — candidate camera (always bottom-right) ───────── */}
        <div className="absolute bottom-20 right-5 z-30
                        w-44 h-28 sm:w-52 sm:h-32
                        rounded-2xl overflow-hidden
                        border-2 border-white/25 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          <CandidateView
            videoRef={videoPipRef}
            cameraError={cameraError}
            candidateName={sessionData.candidateName}
            isMain={false}
          />
        </div>

        {/* ── Error overlay ──────────────────────────────────────────────── */}
        {previewError && agentLoaded && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center z-40 px-6">
            <div className="bg-slate-900/95 backdrop-blur-sm border border-red-400/30
                            rounded-2xl px-6 py-5 max-w-sm w-full text-center shadow-2xl">
              <p className="text-sm font-semibold text-red-300 mb-1">Connection Failed</p>
              <p className="text-xs text-white/60 mb-4 leading-relaxed">{previewError}</p>
              <button onClick={handleRetryPreview}
                className="w-full py-2.5 rounded-xl bg-white text-slate-900
                           text-sm font-semibold hover:bg-slate-100 transition-colors">
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* ── Bottom controls bar ────────────────────────────────────────── */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30
                        flex items-center gap-3">
          <button onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 border border-white/20
                       flex items-center justify-center text-white transition-all backdrop-blur-sm">
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          <button onClick={() => setShowExitModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full
                       bg-red-500 hover:bg-red-600 text-white text-sm font-semibold
                       transition-all shadow-lg hover:shadow-red-500/30">
            <XCircle size={16} />
            End Session
          </button>
        </div>
      </div>

      {/* ── Violation Toast ───────────────────────────────────────────────────── */}
      {showViolation && (
        <div className="fixed top-16 right-4 z-50 animate-slide-right">
          <div className="flex items-start gap-3 bg-white rounded-xl shadow-card-xl
                          border-l-4 border-orange-400 p-4 max-w-sm">
            <AlertTriangle size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-800">Violation Detected</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{showViolation.msg}</p>
              <p className="text-xs font-semibold text-orange-600 mt-1.5">
                {violations}/{MAX_VIOLATIONS} warnings — session ends at {MAX_VIOLATIONS}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Fullscreen reminder strip ─────────────────────────────────────────── */}
      {!isFullscreen && agentLoaded && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-amber-500 text-amber-950
                        py-2.5 px-5 flex items-center justify-between text-sm font-semibold">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            Please enter fullscreen mode to continue your interview.
          </div>
          <button onClick={toggleFullscreen}
            className="flex items-center gap-1 bg-amber-900/20 hover:bg-amber-900/30
                       rounded-lg px-3 py-1 text-xs transition-colors">
            Go Fullscreen <ChevronRight size={13} />
          </button>
        </div>
      )}

      {/* ── DevTools Blocking Overlay ────────────────────────────────────────── */}
      {devToolsOpen && (
        <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center">
            <ShieldX size={32} className="text-red-400" />
          </div>
          <h2 className="text-white text-xl font-extrabold tracking-tight">Developer Tools Detected</h2>
          <p className="text-white/55 text-sm text-center max-w-xs leading-relaxed">
            Please close DevTools to continue your interview. The session is paused until it is closed.
          </p>
        </div>
      )}

      {/* ── Exit Confirmation Modal ───────────────────────────────────────────── */}
      {showExitModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50
                        flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-card-xl max-w-md w-full p-8 animate-fade-up">
            <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-5">
              <AlertTriangle size={24} className="text-red-500" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 text-center mb-2 tracking-tight">
              End Your Interview?
            </h3>
            <p className="text-slate-500 text-sm text-center leading-relaxed mb-6">
              Ending the session early will{' '}
              <span className="font-semibold text-slate-700">permanently close</span> this interview link.
              Since each link is single-use, you will{' '}
              <span className="font-semibold text-red-600">not be able to restart</span>.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-6
                            flex items-start gap-2.5">
              <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                The hiring team will be notified of an early termination. Only proceed if you are absolutely certain.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowExitModal(false)}
                className="flex-1 py-3 rounded-xl border-2 border-slate-200 font-semibold
                           text-sm text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all">
                Continue Interview
              </button>
              <button onClick={confirmExit}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 font-semibold
                           text-sm text-white transition-all hover:shadow-[0_4px_14px_-4px_rgba(239,68,68,0.5)]">
                Yes, End Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
