import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clock, CheckCircle2, Code2, Play, Send, Loader2,
  ChevronDown, Terminal, XCircle, AlertTriangle,
  Maximize2, Minimize2, ShieldX, MonitorX,
} from 'lucide-react'
import { getCodingQuestions, getCompilerLanguages, runCode, submitCode } from '../apis/apiService'

const DIFFICULTY = {
  easy:   'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  hard:   'bg-red-100 text-red-700',
}

const MAX_VIOLATIONS    = 3
const CODING_TIME_LIMIT = 30 * 60  // 30 minutes in seconds
const MONITORING_ENABLED = false   // set to true to enforce fullscreen + violations

export default function CodingRound({ sessionData }) {
  const navigate          = useNavigate()
  const editorRef         = useRef(null)
  const containerRef      = useRef(null)
  const toastTimerRef     = useRef(null)
  const lastViolationRef  = useRef(0)
  const autoSubmittedRef  = useRef(false)

  // ── Data ────────────────────────────────────────────────────────────────────
  const [loading, setLoading]           = useState(true)
  const [fetchError, setFetchError]     = useState(null)
  const [questions, setQuestions]       = useState([])
  const [languages, setLanguages]       = useState([])

  // ── Editor ──────────────────────────────────────────────────────────────────
  const [selectedQ, setSelectedQ]           = useState(0)
  const [selectedLangId, setSelectedLangId] = useState(71)
  const [codeMap, setCodeMap]               = useState({ 0: '', 1: '' })
  const [submittedMap, setSubmittedMap]     = useState({ 0: false, 1: false })
  const [isRunning, setIsRunning]           = useState(false)
  const [isSubmitting, setIsSubmitting]     = useState(false)
  const [runResults, setRunResults]         = useState(null)
  const [runError, setRunError]             = useState('')
  const [submitMsg, setSubmitMsg]           = useState('')
  const [done, setDone]                     = useState(false)
  const [autoSubmitting, setAutoSubmitting] = useState(false)

  // ── Timer ───────────────────────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState(CODING_TIME_LIMIT)

  // ── Monitoring ──────────────────────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen]         = useState(false)
  const [violations, setViolations]             = useState(0)
  const [terminated, setTerminated]             = useState(false)
  const [showViolation, setShowViolation]       = useState(null)
  const [monitoringActive, setMonitoringActive] = useState(false)
  const [devToolsOpen, setDevToolsOpen]         = useState(false)
  const [extraScreenDetected, setExtraScreen]   = useState(false)

  // ── Load questions + languages ───────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      getCodingQuestions(sessionData.applicationId),
      getCompilerLanguages(),
    ])
      .then(([qs, langs]) => {
        setQuestions(Array.isArray(qs) ? qs : [])
        setLanguages(langs)
      })
      .catch(err => setFetchError(err.message || 'Failed to load coding round.'))
      .finally(() => setLoading(false))
  }, [sessionData.applicationId])

  // ── Once loaded: request fullscreen + start monitoring after 4s ─────────────
  useEffect(() => {
    if (loading || !MONITORING_ENABLED) return
    containerRef.current?.requestFullscreen?.().catch(() => {})
    const id = setTimeout(() => setMonitoringActive(true), 4000)
    return () => clearTimeout(id)
  }, [loading])

  // ── Language fallback if id 71 not in list ───────────────────────────────────
  useEffect(() => {
    if (!languages.length) return
    if (!languages.some(l => l.id === 71)) setSelectedLangId(languages[0].id)
  }, [languages])

  // ── Countdown timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || done || terminated || timeLeft <= 0) return
    const id = setInterval(() => setTimeLeft(prev => Math.max(0, prev - 1)), 1000)
    return () => clearInterval(id)
  }, [loading, done, terminated, timeLeft])

  // ── Auto-submit when timer hits zero ─────────────────────────────────────────
  useEffect(() => {
    if (timeLeft !== 0 || done || terminated || loading || autoSubmittedRef.current) return
    autoSubmittedRef.current = true

    const doAutoSubmit = async () => {
      setAutoSubmitting(true)
      const currentSrc  = editorRef.current?.value ?? codeMap[selectedQ]
      const finalCodeMap = { ...codeMap, [selectedQ]: currentSrc }
      const lang         = languages.find(l => l.id === selectedLangId)

      for (let i = 0; i < questions.length; i++) {
        if (!submittedMap[i]) {
          try {
            await submitCode(sessionData.applicationId, {
              question_index: questions[i]?.index ?? i,
              language_id:    selectedLangId,
              language_name:  lang?.name || 'Python (3.8.1)',
              source_code:    finalCodeMap[i] || '',
            })
          } catch { /* best effort */ }
        }
      }
      sessionStorage.removeItem('interview_session')
      navigate('/session-complete')
    }
    doAutoSubmit()
  }, [timeLeft]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup toast timer ──────────────────────────────────────────────────────
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current) }, [])

  // ── Violation helper ─────────────────────────────────────────────────────────
  const raiseViolation = useCallback((type, msg) => {
    const now = Date.now()
    if (now - lastViolationRef.current < 1000) return
    lastViolationRef.current = now
    setViolations(prev => {
      const next = prev + 1
      if (next >= MAX_VIOLATIONS) setTerminated(true)
      return next
    })
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setShowViolation({ msg })
    toastTimerRef.current = setTimeout(() => setShowViolation(null), 5000)
  }, [])

  // ── Fullscreen change ────────────────────────────────────────────────────────
  useEffect(() => {
    const h = () => {
      const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement)
      setIsFullscreen(isFS)
      if (!isFS && monitoringActive && !terminated && !done)
        raiseViolation('fullscreen_exit', 'You exited fullscreen. Return to fullscreen to continue — this is a violation.')
    }
    document.addEventListener('fullscreenchange', h)
    document.addEventListener('webkitfullscreenchange', h)
    return () => {
      document.removeEventListener('fullscreenchange', h)
      document.removeEventListener('webkitfullscreenchange', h)
    }
  }, [monitoringActive, terminated, done, raiseViolation])

  // ── Tab visibility ───────────────────────────────────────────────────────────
  useEffect(() => {
    const h = () => {
      if (document.hidden && monitoringActive && !terminated && !done)
        raiseViolation('tab_switch', 'You switched away from this tab. Return immediately — this is a violation.')
    }
    document.addEventListener('visibilitychange', h)
    return () => document.removeEventListener('visibilitychange', h)
  }, [raiseViolation, monitoringActive, terminated, done])

  // ── Window focus loss ────────────────────────────────────────────────────────
  useEffect(() => {
    const h = () => {
      if (monitoringActive && !terminated && !done)
        raiseViolation('focus_loss', 'You moved away from this window. Return immediately — this is a violation.')
    }
    window.addEventListener('blur', h)
    return () => window.removeEventListener('blur', h)
  }, [raiseViolation, monitoringActive, terminated, done])

  useEffect(() => {
    if (!monitoringActive || terminated || done) return
    const id = setInterval(() => {
      if (!document.hasFocus() && !terminated && !done)
        raiseViolation('focus_loss', 'You moved away from this window. Return immediately — this is a violation.')
    }, 1000)
    return () => clearInterval(id)
  }, [raiseViolation, monitoringActive, terminated, done])

  // ── DevTools detection ───────────────────────────────────────────────────────
  useEffect(() => {
    const devRef = { current: false }
    const check = () => {
      const open = window.outerWidth - window.innerWidth > 160 || window.outerHeight - window.innerHeight > 160
      setDevToolsOpen(open)
      if (open && !devRef.current) {
        devRef.current = true
        if (!terminated && !done) raiseViolation('devtools', 'Browser DevTools detected. Close it to continue.')
      } else if (!open) devRef.current = false
    }
    check()
    const id = setInterval(check, 2000)
    return () => clearInterval(id)
  }, [raiseViolation, terminated, done])

  // ── Multi-screen detection ───────────────────────────────────────────────────
  useEffect(() => {
    const onScreenChange = () => {
      const extended = !!(window.screen?.isExtended)
      setExtraScreen(extended)
      if (extended && monitoringActive && !terminated && !done)
        raiseViolation('multi_screen', 'A second screen was detected. Disconnect it to continue.')
    }
    if (typeof window.screen?.isExtended === 'boolean') {
      onScreenChange()
      window.screen.addEventListener('change', onScreenChange)
    }
    return () => window.screen?.removeEventListener('change', onScreenChange)
  }, [monitoringActive, raiseViolation, terminated, done])

  // ── Block context menu + devtools keys ───────────────────────────────────────
  useEffect(() => {
    const block    = e => e.preventDefault()
    const blockKey = e => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) || (e.ctrlKey && e.key === 'u'))
        e.preventDefault()
    }
    document.addEventListener('contextmenu', block)
    document.addEventListener('keydown', blockKey)
    return () => {
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('keydown', blockKey)
    }
  }, [])

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const toggleFullscreen = () => {
    if (!isFullscreen) containerRef.current?.requestFullscreen?.().catch(() => {})
    else document.exitFullscreen?.().catch(() => {})
  }

  const formatCountdown = (s) => {
    const m   = String(Math.floor(s / 60)).padStart(2, '0')
    const sec = String(s % 60).padStart(2, '0')
    return `${m}:${sec}`
  }

  const currentLang    = languages.find(l => l.id === selectedLangId)
  const submittedCount = Object.values(submittedMap).filter(Boolean).length
  const isLow          = timeLeft <= 5 * 60 && timeLeft > 0

  const switchQuestion = (i) => {
    if (editorRef.current) setCodeMap(prev => ({ ...prev, [selectedQ]: editorRef.current.value }))
    setSelectedQ(i)
    setRunResults(null)
    setRunError('')
    setSubmitMsg('')
  }

  const handleRun = async () => {
    const src = editorRef.current?.value ?? codeMap[selectedQ]
    setCodeMap(prev => ({ ...prev, [selectedQ]: src }))
    setIsRunning(true)
    setRunResults(null)
    setRunError('')
    setSubmitMsg('')
    try {
      const res   = await runCode(sessionData.applicationId, {
        question_index: questions[selectedQ]?.index ?? selectedQ,
        language_id:    selectedLangId,
        source_code:    src,
      })
      const items = Array.isArray(res) ? res : (res?.results ?? res?.test_results ?? null)
      setRunResults(items)
    } catch (err) {
      setRunError(err.message || 'Failed to run code.')
    } finally {
      setIsRunning(false)
    }
  }

  const handleSubmit = async () => {
    if (submittedMap[selectedQ]) return
    const src = editorRef.current?.value ?? codeMap[selectedQ]
    setCodeMap(prev => ({ ...prev, [selectedQ]: src }))
    setIsSubmitting(true)
    setRunError('')
    setSubmitMsg('')
    try {
      await submitCode(sessionData.applicationId, {
        question_index: questions[selectedQ]?.index ?? selectedQ,
        language_id:    selectedLangId,
        language_name:  currentLang?.name || 'Python (3.8.1)',
        source_code:    src,
      })
      const updated = { ...submittedMap, [selectedQ]: true }
      setSubmittedMap(updated)
      setSubmitMsg('Solution submitted successfully!')
      if (Object.values(updated).every(Boolean)) setTimeout(() => setDone(true), 1000)
    } catch (err) {
      setRunError(err.message || 'Submission failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFinish = () => {
    sessionStorage.removeItem('interview_session')
    navigate('/session-complete')
  }

  const handleTerminatedClose = () => {
    sessionStorage.removeItem('interview_session')
    navigate('/session-complete')
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" />
          <p className="text-slate-500 text-sm">Loading coding round…</p>
        </div>
      </div>
    )
  }

  // ── No coding round ──────────────────────────────────────────────────────────
  if (fetchError || questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-card-xl max-w-md w-full p-10 text-center animate-fade-up">
          <div className="text-5xl mb-5 select-none">💻</div>
          <h2 className="text-xl font-extrabold text-slate-900 mb-2">No Coding Round</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-7">
            There is no coding round assigned for your application. Your interview is complete!
          </p>
          <button onClick={handleFinish}
            className="w-full py-3 rounded-xl bg-navy-800 hover:bg-navy-700 text-white font-semibold text-sm transition-all">
            Continue to Summary
          </button>
        </div>
      </div>
    )
  }

  // ── Completion (all submitted) ────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-card-xl max-w-lg w-full p-10 text-center animate-fade-up border border-slate-100">
          <div className="text-6xl mb-6 select-none">🎉</div>
          <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-1.5 mb-5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-bold text-green-700 uppercase tracking-widest">Interview Submitted</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-3">
            Thank You for Your Time! 🙌
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed mb-8">
            Your interview session has been successfully completed and submitted.
            Our team will review your responses and get back to you soon.
          </p>
          <p className="text-slate-400 text-xs">
            Questions? Reach us at{' '}
            <a href="mailto:support@purviewcallohm.com" className="text-accent hover:underline font-medium">
              support@purviewcallohm.com
            </a>
          </p>
        </div>
      </div>
    )
  }

  const currentQ     = questions[selectedQ]
  const visibleTests = currentQ?.test_cases?.filter(tc => tc.visible) ?? []

  return (
    <div ref={containerRef} className="flex flex-col bg-slate-100 overflow-hidden" style={{ height: '100vh' }}>

      {/* ── Extra Screen Overlay ─────────────────────────────────────────────── */}
      {extraScreenDetected && !terminated && (
        <div className="fixed inset-0 bg-black z-[9998] flex flex-col items-center justify-center gap-5 p-8">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center">
            <MonitorX size={32} className="text-red-400" />
          </div>
          <div className="text-center max-w-sm">
            <h2 className="text-white text-xl font-extrabold mb-2">Second Screen Detected</h2>
            <p className="text-white/55 text-sm leading-relaxed">
              Please disconnect the external monitor. The test is paused until only one screen is active.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-red-500/15 border border-red-400/30 rounded-xl px-4 py-2.5 text-red-300 text-xs font-semibold">
            <AlertTriangle size={14} />
            This violation has been recorded.
          </div>
        </div>
      )}

      {/* ── DevTools Overlay ─────────────────────────────────────────────────── */}
      {devToolsOpen && (
        <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center">
            <ShieldX size={32} className="text-red-400" />
          </div>
          <h2 className="text-white text-xl font-extrabold">Developer Tools Detected</h2>
          <p className="text-white/55 text-sm text-center max-w-xs leading-relaxed">
            Close DevTools to continue the coding round.
          </p>
        </div>
      )}

      {/* ── Terminated Overlay ───────────────────────────────────────────────── */}
      {terminated && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[9999] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-card-xl max-w-md w-full p-10 text-center animate-fade-up">
            <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-5">
              <ShieldX size={28} className="text-red-500" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mb-2">Session Terminated</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              Your session has been terminated due to multiple violations. This has been recorded and the hiring team has been notified.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="text-red-700 text-xs font-semibold">
                {violations} violation{violations !== 1 ? 's' : ''} recorded
              </p>
            </div>
            <button onClick={handleTerminatedClose}
              className="w-full py-3 rounded-xl bg-navy-800 hover:bg-navy-700 text-white font-semibold text-sm transition-all">
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Auto-submit Overlay ───────────────────────────────────────────────── */}
      {autoSubmitting && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center gap-5">
          <div className="text-6xl select-none">⏱️</div>
          <Loader2 size={32} className="text-blue-400 animate-spin" />
          <div className="text-center">
            <h2 className="text-white text-xl font-extrabold mb-2">Time's Up!</h2>
            <p className="text-white/60 text-sm">Submitting your solutions automatically…</p>
          </div>
        </div>
      )}

      {/* ── Violation Toast ──────────────────────────────────────────────────── */}
      {showViolation && (
        <div className="fixed top-20 right-4 z-50 animate-slide-right">
          <div className="flex items-start gap-3 bg-white rounded-xl shadow-card-xl border-l-4 border-orange-400 p-4 max-w-sm">
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

      {/* ── Fullscreen Reminder ───────────────────────────────────────────────── */}
      {!isFullscreen && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-amber-500 text-amber-950
                        py-2.5 px-5 flex items-center justify-between text-sm font-semibold">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            Please enter fullscreen mode to continue your coding round.
          </div>
          <button onClick={toggleFullscreen}
            className="flex items-center gap-1.5 bg-amber-900/20 hover:bg-amber-900/30 rounded-lg px-3 py-1 text-xs transition-colors">
            Go Fullscreen <Maximize2 size={12} />
          </button>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-5 py-3
                         flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/callohm-logo.png" alt="Callohm" className="h-7 w-auto object-contain" />
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-1.5">
            <Code2 size={14} className="text-blue-600" />
            <span className="text-sm font-bold text-slate-800">Coding Round</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium">
          <span className="text-slate-700 font-semibold hidden sm:inline">{sessionData.candidateName}</span>

          {/* Countdown timer pill */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-mono font-bold transition-colors ${
            isLow
              ? 'bg-red-100 text-red-600 border border-red-300'
              : 'bg-slate-100 text-slate-700 border border-slate-200'
          }`}>
            <Clock size={13} className={isLow ? 'text-red-500' : 'text-slate-500'} />
            {formatCountdown(timeLeft)}
          </div>

          {/* Submitted count */}
          <div className={`flex items-center gap-1.5 font-semibold ${submittedCount === questions.length ? 'text-green-600' : 'text-slate-400'}`}>
            <CheckCircle2 size={13} />
            <span>{submittedCount}/{questions.length} submitted</span>
          </div>

          {/* Fullscreen toggle */}
          <button onClick={toggleFullscreen}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </header>

      {/* ── Timer Info Strip ─────────────────────────────────────────────────── */}
      <div className={`flex-shrink-0 border-b px-5 py-1.5 flex items-center gap-2 transition-colors ${
        isLow ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-100'
      }`}>
        {isLow
          ? <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />
          : <Clock size={12} className="text-blue-400 flex-shrink-0" />}
        <span className={`text-xs font-medium ${isLow ? 'text-red-600 font-bold' : 'text-blue-600'}`}>
          {isLow
            ? `⚠ Only ${formatCountdown(timeLeft)} remaining — all answers will be auto-submitted when the timer ends!`
            : `You have ${formatCountdown(timeLeft)} remaining. All answers will be auto-submitted when the timer ends.`}
        </span>
      </div>

      {/* ── Main layout ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left panel: Questions + Detail ──────────────────────────────── */}
        <aside className="w-80 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">

          {/* Question cards */}
          <div className="p-4 border-b border-slate-100 flex-shrink-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Questions</p>
            <div className="space-y-2">
              {questions.map((q, i) => (
                <button key={q.index ?? i} onClick={() => switchQuestion(i)}
                  className={`w-full text-left p-3 rounded-xl border transition-all duration-150 ${
                    selectedQ === i
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}>
                  <div className="flex items-start gap-2 justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs font-bold flex-shrink-0 ${selectedQ === i ? 'text-blue-600' : 'text-slate-400'}`}>
                        Q{i + 1}
                      </span>
                      <p className="text-sm font-semibold text-slate-800 leading-tight truncate">{q.title}</p>
                    </div>
                    {q.difficulty && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 capitalize
                                       ${DIFFICULTY[q.difficulty] || 'bg-slate-100 text-slate-600'}`}>
                        {q.difficulty}
                      </span>
                    )}
                  </div>
                  {q.topics?.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {q.topics.map(t => (
                        <span key={t} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  )}
                  {submittedMap[i] && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <CheckCircle2 size={11} className="text-green-500" />
                      <span className="text-[11px] font-semibold text-green-600">Submitted</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Question detail */}
          {currentQ && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 mb-1.5">{currentQ.title}</h2>
                <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap">{currentQ.description}</p>
              </div>

              {currentQ.constraints?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Constraints</p>
                  <ul className="space-y-1">
                    {currentQ.constraints.map((c, i) => (
                      <li key={i} className="flex gap-2 text-xs text-slate-500">
                        <span className="text-slate-300 flex-shrink-0">•</span>
                        <code className="font-mono">{c}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {visibleTests.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Examples</p>
                  <div className="space-y-2">
                    {visibleTests.map((tc, i) => (
                      <div key={i} className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-1.5">
                        <div className="flex items-start gap-2">
                          <span className="text-slate-400 w-14 flex-shrink-0">Input:</span>
                          <code className="font-mono text-slate-700 bg-white border border-slate-200 px-1.5 rounded break-all">{tc.stdin}</code>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-slate-400 w-14 flex-shrink-0">Output:</span>
                          <code className="font-mono text-slate-700 bg-white border border-slate-200 px-1.5 rounded break-all">{tc.expected_output}</code>
                        </div>
                        {tc.explanation && (
                          <p className="text-slate-400 italic leading-snug pt-0.5">{tc.explanation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* ── Right panel: Editor ──────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* Toolbar */}
          <div className="flex-shrink-0 bg-[#1e293b] border-b border-slate-700 px-4 py-2
                          flex items-center justify-between gap-3">
            <div className="relative">
              <select
                value={selectedLangId}
                onChange={e => setSelectedLangId(Number(e.target.value))}
                className="appearance-none bg-slate-700 text-slate-200 text-xs font-medium
                           pl-3 pr-7 py-1.5 rounded-lg border border-slate-600
                           focus:outline-none focus:border-slate-400 cursor-pointer">
                {languages.length === 0 && <option disabled>Loading…</option>}
                {languages.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            <div className="flex items-center gap-2">
              <button onClick={handleRun} disabled={isRunning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500
                           text-white text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-wait">
                {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                {isRunning ? 'Running…' : 'Run Code'}
              </button>
              <button onClick={handleSubmit} disabled={isSubmitting || submittedMap[selectedQ]}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold
                            transition-colors disabled:opacity-60 disabled:cursor-not-allowed
                            ${submittedMap[selectedQ] ? 'bg-green-700' : 'bg-blue-600 hover:bg-blue-500'}`}>
                {isSubmitting
                  ? <><Loader2 size={12} className="animate-spin" /> Submitting…</>
                  : submittedMap[selectedQ]
                    ? <><CheckCircle2 size={12} /> Submitted</>
                    : <><Send size={12} /> Submit</>}
              </button>
            </div>
          </div>

          {/* Code editor */}
          <div className="flex-1 overflow-hidden min-h-0 bg-[#1e1e1e]">
            <textarea
              key={selectedQ}
              ref={editorRef}
              defaultValue={codeMap[selectedQ]}
              onChange={e => setCodeMap(prev => ({ ...prev, [selectedQ]: e.target.value }))}
              onKeyDown={e => {
                if (e.key !== 'Tab') return
                e.preventDefault()
                const el = e.target, start = el.selectionStart
                el.value = el.value.substring(0, start) + '    ' + el.value.substring(el.selectionEnd)
                el.selectionStart = el.selectionEnd = start + 4
                setCodeMap(prev => ({ ...prev, [selectedQ]: el.value }))
              }}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              placeholder="# Write your solution here..."
              className="w-full h-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm leading-relaxed
                         p-5 resize-none outline-none border-none placeholder-[#4a5568] block"
            />
          </div>

          {/* Output panel */}
          <div className="flex-shrink-0 h-44 bg-[#1a1a2e] border-t border-slate-700 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-700/60 bg-[#16213e] flex-shrink-0">
              <Terminal size={12} className="text-slate-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Output</span>
              {(runResults || runError || submitMsg) && (
                <button onClick={() => { setRunResults(null); setRunError(''); setSubmitMsg('') }}
                  className="ml-auto text-slate-500 hover:text-slate-300 transition-colors">
                  <XCircle size={12} />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {!isRunning && !runResults && !runError && !submitMsg && (
                <p className="text-xs text-slate-500 italic">Run your code to see results here.</p>
              )}
              {isRunning && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 size={12} className="animate-spin" />
                  Executing against test cases…
                </div>
              )}
              {runError && (
                <div className="flex items-start gap-2 text-xs text-red-400">
                  <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                  <span>{runError}</span>
                </div>
              )}
              {submitMsg && (
                <div className="flex items-center gap-2 text-xs text-green-400 font-semibold">
                  <CheckCircle2 size={12} />{submitMsg}
                </div>
              )}
              {runResults && !isRunning && (
                Array.isArray(runResults)
                  ? runResults.map((r, i) => {
                      const passed = r.status === 'Accepted' || r.passed === true
                        || (r.stdout?.trim() !== undefined && r.stdout?.trim() === r.expected_output?.trim())
                      return (
                        <div key={i}
                          className={`rounded-lg p-2.5 text-[11px] space-y-1.5 ${
                            passed
                              ? 'bg-green-900/30 border border-green-700/30'
                              : 'bg-red-900/30 border border-red-700/30'
                          }`}>
                          <div className="flex items-center gap-1.5 font-semibold">
                            {passed
                              ? <CheckCircle2 size={11} className="text-green-400" />
                              : <XCircle size={11} className="text-red-400" />}
                            <span className={passed ? 'text-green-400' : 'text-red-400'}>
                              Test {i + 1} — {r.status || (passed ? 'Passed' : 'Failed')}
                            </span>
                            {r.time && <span className="text-slate-500 ml-auto font-normal">{r.time}s</span>}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400 space-y-0.5">
                            {r.stdin        != null && <div><span className="text-slate-500">in:  </span><span className="text-slate-300">{r.stdin}</span></div>}
                            {r.expected_output != null && <div><span className="text-slate-500">exp: </span><span className="text-slate-300">{r.expected_output}</span></div>}
                            {r.stdout       != null && <div><span className="text-slate-500">got: </span><span className={passed ? 'text-green-300' : 'text-red-300'}>{r.stdout || '(empty)'}</span></div>}
                            {r.stderr                && <div><span className="text-slate-500">err: </span><span className="text-red-400">{r.stderr}</span></div>}
                          </div>
                        </div>
                      )
                    })
                  : (
                    <pre className="text-[11px] text-slate-300 whitespace-pre-wrap font-mono">
                      {JSON.stringify(runResults, null, 2)}
                    </pre>
                  )
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
