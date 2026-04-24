import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2, Circle, AlertTriangle, Camera, Mic,
  Volume2, Wifi, WifiOff, Monitor, Clock, ShieldAlert,
  RefreshCcw, Maximize, ChevronRight, Loader2,
  CheckCheck, XCircle, RotateCcw,
} from 'lucide-react'

const INSTRUCTIONS = [
  {
    icon: <Monitor size={18} />,
    color: 'bg-blue-50 text-blue-600',
    title: 'Stable Internet & Device',
    desc: 'Use a reliable Wi-Fi or wired connection. Keep your device fully charged or plugged in.',
  },
  {
    icon: <Volume2 size={18} />,
    color: 'bg-violet-50 text-violet-600',
    title: 'Quiet Environment',
    desc: 'Find a silent, well-lit room free from interruptions. Inform others not to disturb you.',
  },
  {
    icon: <Clock size={18} />,
    color: 'bg-amber-50 text-amber-600',
    title: 'Allocate Sufficient Time',
    desc: 'Set aside uninterrupted time. Closing the session prematurely may forfeit your attempt.',
  },
  {
    icon: <ShieldAlert size={18} />,
    color: 'bg-red-50 text-red-600',
    title: 'One-Time Session Only',
    desc: 'This interview link can only be used once. You cannot restart once the session is closed.',
  },
  {
    icon: <Maximize size={18} />,
    color: 'bg-slate-100 text-slate-700',
    title: 'Do Not Switch Windows',
    desc: 'Switching to another window or tab during the interview will be flagged as a violation.',
  },
  {
    icon: <RefreshCcw size={18} />,
    color: 'bg-orange-50 text-orange-600',
    title: 'Avoid Refresh or Back',
    desc: 'Do not press F5, back, or close the tab during the assessment. This cannot be undone.',
  },
  {
    icon: <Wifi size={18} />,
    color: 'bg-teal-50 text-teal-600',
    title: 'Camera & Mic Must Stay On',
    desc: 'Keep your camera and microphone active throughout. Disabling them will end the session.',
  },
  {
    icon: <CheckCheck size={18} />,
    color: 'bg-green-50 text-green-600',
    title: 'Answer Naturally & Honestly',
    desc: 'Speak clearly, take your time, and respond honestly. The AI evaluates depth and clarity.',
  },
]

const PERMISSION_STATUS = { idle: 'idle', requesting: 'requesting', granted: 'granted', denied: 'denied' }

// ── Network quality helpers ───────────────────────────────────────────────────
function getNetworkQuality({ online, rtt, downlink, effectiveType }) {
  if (!online) return { level: 'offline', label: 'No Connection', color: 'red' }
  if (effectiveType === 'slow-2g' || (rtt > 600)) return { level: 'poor',      label: 'Poor',      color: 'red'    }
  if (effectiveType === '2g'      || (rtt > 300)) return { level: 'fair',      label: 'Fair',      color: 'orange' }
  if (effectiveType === '3g'      || (rtt > 100)) return { level: 'good',      label: 'Good',      color: 'yellow' }
  return                                                 { level: 'excellent',  label: 'Excellent', color: 'green'  }
}

function NetworkCheck() {
  const [online, setOnline]         = useState(navigator.onLine)
  const [latency, setLatency]       = useState(null)   // ms
  const [downlink, setDownlink]     = useState(null)   // Mbps
  const [effectiveType, setEffType] = useState(null)
  const [checking, setChecking]     = useState(false)
  const intervalRef = useRef(null)

  const measureLatency = useCallback(async () => {
    if (!navigator.onLine) { setLatency(null); return }
    setChecking(true)
    try {
      const t0 = performance.now()
      await fetch('/favicon.svg?_=' + Date.now(), { cache: 'no-store', mode: 'no-cors' })
      setLatency(Math.round(performance.now() - t0))
    } catch {
      setLatency(null)
    } finally {
      setChecking(false)
    }
  }, [])

  const readConnection = useCallback(() => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    if (conn) {
      setDownlink(conn.downlink ?? null)
      setEffType(conn.effectiveType ?? null)
    }
  }, [])

  useEffect(() => {
    const handleOnline  = () => { setOnline(true);  measureLatency(); readConnection() }
    const handleOffline = () => { setOnline(false); setLatency(null) }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    conn?.addEventListener('change', readConnection)

    // Initial read
    readConnection()
    measureLatency()

    // Re-check every 8 seconds
    intervalRef.current = setInterval(() => {
      readConnection()
      measureLatency()
    }, 8000)

    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
      conn?.removeEventListener('change', readConnection)
      clearInterval(intervalRef.current)
    }
  }, [measureLatency, readConnection])

  const rtt = latency ?? (navigator.connection?.rtt ?? null)
  const quality = getNetworkQuality({ online, rtt, downlink, effectiveType })

  const colorMap = {
    green:  { ring: 'border-green-200 bg-green-50',   icon: 'bg-green-100 text-green-600',  text: 'text-green-700',  bar: 'bg-green-500'  },
    yellow: { ring: 'border-yellow-200 bg-yellow-50', icon: 'bg-yellow-100 text-yellow-600',text: 'text-yellow-700', bar: 'bg-yellow-400' },
    orange: { ring: 'border-orange-200 bg-orange-50', icon: 'bg-orange-100 text-orange-600',text: 'text-orange-700', bar: 'bg-orange-400' },
    red:    { ring: 'border-red-200 bg-red-50',       icon: 'bg-red-100 text-red-600',      text: 'text-red-700',    bar: 'bg-red-500'    },
  }
  const c = colorMap[quality.color]

  const barWidths = { excellent: 'w-full', good: 'w-3/4', fair: 'w-1/2', poor: 'w-1/4', offline: 'w-0' }

  return (
    <div className={`p-4 rounded-xl border transition-all duration-300 ${c.ring}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.icon}`}>
            {online ? <Wifi size={18} /> : <WifiOff size={18} />}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Internet Stability</p>
            <p className={`text-xs font-semibold ${c.text}`}>{quality.label}</p>
          </div>
        </div>

        <button
          onClick={measureLatency}
          disabled={checking || !online}
          title="Re-check connection"
          className="w-7 h-7 rounded-lg bg-white/70 hover:bg-white border border-slate-200
                     flex items-center justify-center text-slate-500 hover:text-slate-700
                     transition-colors duration-150 disabled:opacity-40"
        >
          <RotateCcw size={13} className={checking ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Signal bar */}
      <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden mb-3">
        <div className={`h-full rounded-full transition-all duration-700 ${c.bar} ${barWidths[quality.level]}`} />
      </div>


      {quality.level === 'poor' && (
        <p className="mt-2.5 text-xs text-red-600 font-medium flex items-center gap-1.5">
          <AlertTriangle size={11} />
          Unstable connection detected. The interview may be disrupted.
        </p>
      )}
      {quality.level === 'fair' && (
        <p className="mt-2.5 text-xs text-orange-600 font-medium flex items-center gap-1.5">
          <AlertTriangle size={11} />
          Connection is moderate. Move closer to your router if possible.
        </p>
      )}
      {!online && (
        <p className="mt-2.5 text-xs text-red-600 font-medium flex items-center gap-1.5">
          <AlertTriangle size={11} />
          You are offline. Please restore your internet connection to proceed.
        </p>
      )}
    </div>
  )
}

export default function Instructions({ sessionData, onStart }) {
  const navigate = useNavigate()
  const [cameraStatus, setCameraStatus] = useState(PERMISSION_STATUS.idle)
  const [micStatus, setMicStatus]       = useState(PERMISSION_STATUS.idle)
  const [agreed, setAgreed]             = useState(false)
  const [starting, setStarting]         = useState(false)

  const allGranted = cameraStatus === 'granted' && micStatus === 'granted'

  useEffect(() => {
    navigator.permissions?.query({ name: 'camera' }).then(r => {
      if (r.state === 'granted') setCameraStatus('granted')
      if (r.state === 'denied')  setCameraStatus('denied')
    }).catch(() => {})
    navigator.permissions?.query({ name: 'microphone' }).then(r => {
      if (r.state === 'granted') setMicStatus('granted')
      if (r.state === 'denied')  setMicStatus('denied')
    }).catch(() => {})
  }, [])

  const requestCamera = async () => {
    setCameraStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach(t => t.stop())
      setCameraStatus('granted')
    } catch {
      setCameraStatus('denied')
    }
  }

  const requestMic = async () => {
    setMicStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
      setMicStatus('granted')
    } catch {
      setMicStatus('denied')
    }
  }

  const handleStartAssessment = async () => {
    setStarting(true)
    await new Promise(r => setTimeout(r, 600))
    onStart({ ...sessionData, started: true })
    navigate('/assessment')
  }

  const canStart = allGranted && agreed && !starting

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Top Bar ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 shadow-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/callohm-logo.png" alt="Callohm" className="h-8 w-auto object-contain" />
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="hidden sm:inline text-xs text-slate-500 font-medium">
              AI Interview Portal
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-700 hidden sm:inline">
              {sessionData.candidateName}
            </span>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50
                            border border-slate-200 rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              {sessionData.applicationId}
            </div>
          </div>
        </div>
      </header>

      {/* ── Progress Steps ───────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-7 h-7 rounded-full bg-green-500 flex items-center
                              justify-center text-white">
                <CheckCircle2 size={15} />
              </div>
              <span className="text-sm font-semibold text-green-600 hidden sm:inline">Verified</span>
            </div>
            <div className="flex-1 h-0.5 mx-3 bg-green-400 min-w-4 max-w-5" />
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-7 h-7 rounded-full bg-navy-800 flex items-center
                              justify-center text-white text-xs font-bold">2</div>
              <span className="text-sm font-semibold text-navy-800 hidden sm:inline">Instructions</span>
            </div>
            <div className="flex-1 h-0.5 mx-3 bg-slate-200 min-w-4 max-w-5" />
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-7 h-7 rounded-full bg-slate-100 border-2 border-slate-200
                              flex items-center justify-center text-slate-400 text-xs font-bold">3</div>
              <span className="text-sm font-semibold text-slate-400 hidden sm:inline">Assessment</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8 animate-fade-up pb-36">

        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Before You Begin
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Please review all instructions and grant the required permissions to proceed.
          </p>
        </div>

        {/* ── System Checks ──────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-3">
            System Checks
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PermissionCard
              icon={<Camera size={20} />}
              label="Camera Access"
              status={cameraStatus}
              onRequest={requestCamera}
            />
            <PermissionCard
              icon={<Mic size={20} />}
              label="Microphone Access"
              status={micStatus}
              onRequest={requestMic}
            />
          </div>

          {/* Internet check spans full width */}
          <div className="mt-3">
            <NetworkCheck />
          </div>

          {(cameraStatus === 'denied' || micStatus === 'denied') && (
            <div className="mt-3 flex items-start gap-2.5 p-3.5 rounded-xl
                            bg-red-50 border border-red-200 text-red-700">
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
              <p className="text-xs leading-relaxed">
                Permission was denied. Click the lock icon in your browser's address bar,
                allow the required permissions, then refresh the page.
              </p>
            </div>
          )}
        </section>

        {/* ── Instructions grid ──────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-3">
            Interview Guidelines
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {INSTRUCTIONS.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3.5 p-4 rounded-xl bg-white
                           border border-slate-100 shadow-card hover:shadow-card-md
                           transition-shadow duration-150"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                                 flex-shrink-0 mt-0.5 ${item.color}`}>
                  {item.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Important notice ───────────────────────────────────────── */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Important Notice</p>
            <p className="text-xs text-amber-700 leading-relaxed mt-0.5">
              By proceeding, you confirm that you are the intended candidate and that no one else
              is assisting you. Any form of malpractice will immediately disqualify your application.
            </p>
          </div>
        </div>
      </main>

      {/* ── Sticky Bottom Bar ────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200
                      shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.08)]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col sm:flex-row
                        items-start sm:items-center gap-4 justify-between">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="custom-checkbox mt-0.5"
            />
            <span className="text-sm text-slate-600 leading-relaxed">
              I have read and understood all the instructions above, and I agree to the{' '}
              <span className="font-semibold text-slate-800">interview terms and conditions.</span>
            </span>
          </label>

          <button
            onClick={handleStartAssessment}
            disabled={!canStart}
            className="flex-shrink-0 flex items-center gap-2.5 px-6 py-3 rounded-xl
                       font-semibold text-sm text-white bg-navy-800 hover:bg-navy-700
                       transition-all duration-150 disabled:opacity-40
                       disabled:cursor-not-allowed hover:shadow-navy hover:-translate-y-0.5
                       active:translate-y-0 whitespace-nowrap"
          >
            {starting ? (
              <><Loader2 size={16} className="animate-spin" /> Starting…</>
            ) : (
              <>Start Assessment <ChevronRight size={16} /></>
            )}
          </button>
        </div>
        {!allGranted && (
          <p className="text-center text-xs text-slate-400 pb-2.5">
            Grant camera &amp; microphone permissions to enable the Start button.
          </p>
        )}
      </div>
    </div>
  )
}

/* ─── Permission Card ────────────────────────────────────────────────────── */
function PermissionCard({ icon, label, status, onRequest }) {
  const config = {
    idle: {
      ring: 'border-slate-200 bg-white',
      iconBg: 'bg-slate-100 text-slate-600',
      text: 'Not yet granted', textColor: 'text-slate-500',
      btn: 'bg-navy-800 hover:bg-navy-700 text-white', btnLabel: 'Grant Permission',
    },
    requesting: {
      ring: 'border-blue-200 bg-blue-50',
      iconBg: 'bg-blue-100 text-blue-600',
      text: 'Requesting…', textColor: 'text-blue-600',
      btn: 'bg-blue-200 text-blue-400 cursor-not-allowed', btnLabel: 'Requesting…',
    },
    granted: {
      ring: 'border-green-200 bg-green-50',
      iconBg: 'bg-green-100 text-green-600',
      text: 'Access granted', textColor: 'text-green-600',
      btn: null, btnLabel: null,
    },
    denied: {
      ring: 'border-red-200 bg-red-50',
      iconBg: 'bg-red-100 text-red-600',
      text: 'Access denied', textColor: 'text-red-600',
      btn: 'bg-red-100 hover:bg-red-200 text-red-700 border border-red-300', btnLabel: 'Retry',
    },
  }
  const c = config[status]

  return (
    <div className={`flex items-center justify-between p-4 rounded-xl border
                     transition-all duration-200 ${c.ring}`}>
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.iconBg}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <div className={`flex items-center gap-1 text-xs font-medium ${c.textColor}`}>
            {status === 'granted'    && <CheckCircle2 size={12} />}
            {status === 'denied'     && <XCircle size={12} />}
            {status === 'requesting' && <Loader2 size={12} className="animate-spin" />}
            {status === 'idle'       && <Circle size={12} />}
            {c.text}
          </div>
        </div>
      </div>
      {c.btn && (
        <button
          onClick={onRequest}
          disabled={status === 'requesting'}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold
                      transition-colors duration-150 flex-shrink-0 ${c.btn}`}
        >
          {c.btnLabel}
        </button>
      )}
    </div>
  )
}
