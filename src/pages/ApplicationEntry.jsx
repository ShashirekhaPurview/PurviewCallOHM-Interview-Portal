import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  IdCard,
  Camera,
  XCircle,
  RefreshCw,
} from 'lucide-react'
import { validateApplication, uploadIdentity } from '../apis/apiService'

const ID_PROOF_TYPES = [
  { value: 'aadhar', label: 'Aadhar' },
  { value: 'pan', label: 'PAN' },
  { value: 'passport', label: 'Passport' },
  { value: 'driving_license', label: 'Driving License' },
]

const PHOTO_VALID_RULES = [
  'Face fully visible',
  'Good lighting',
  'Looking straight at camera',
  'Eyes clearly visible',
]

const PHOTO_INVALID_RULES = [
  'Face cropped or hidden',
  'Mask, sunglasses, or cap',
  'Side profile or looking away',
  'Blurred or dark photo',
]

const ID_VALID_RULES = [
  'Entire document visible',
  'Text sharp and readable',
  'No glare or reflection',
  'All edges inside frame',
]

const ID_INVALID_RULES = [
  'Avoid flash or bright glare',
  'Do not capture in low light',
  'Do not cover details with fingers',
  'Keep the full card inside the frame',
]

const PHOTO_INVALID_EXAMPLES = [
  { src: '/images/mask_candidate.png', label: 'Remove mask' },
  { src: '/images/low_lighting_candidate.png', label: 'Insufficient lighting' },
  { src: '/images/not_facing_camers_candidate.png', label: 'Face not facing camera' },
]

const ID_INVALID_EXAMPLES = [
  { src: '/images/flash_id.png', label: 'Avoid flash glare' },
  { src: '/images/low_light_id.png', label: 'Use proper lighting' },
  { src: '/images/covered_id.png', label: 'Do not cover information' },
]

function RuleItem({ children, tone = 'valid' }) {
  const Icon = tone === 'valid' ? CheckCircle2 : XCircle
  const toneClass = tone === 'valid' ? 'text-emerald-700' : 'text-red-700'

  return (
    <li className="flex items-start gap-1.5 text-xs font-medium text-slate-700">
      <Icon size={14} className={`mt-0.5 flex-shrink-0 ${toneClass}`} />
      <span>{children}</span>
    </li>
  )
}

function InvalidExample({ src, label }) {
  return (
    <div className="rounded-lg border border-red-100 bg-white p-1.5">
      <div className="relative mb-1.5 aspect-video overflow-hidden rounded-md bg-slate-100">
        <img src={src} alt={label} className="h-full w-full object-cover" />
        <XCircle
          size={18}
          className="absolute left-1 top-1 rounded-full bg-white text-red-600 shadow-sm"
        />
      </div>
      <p className="text-center text-[11px] font-semibold leading-snug text-slate-700">{label}</p>
    </div>
  )
}

function Stepper({ steps }) {
  return (
    <ol className="flex items-center">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        return (
          <li key={step.label} className="flex items-center">
            <div className="flex items-center gap-2.5">
              <span className="relative flex items-center justify-center">
                {step.active && (
                  <span className="absolute inline-flex h-8 w-8 animate-ping rounded-full bg-accent/25" />
                )}
                <span
                  className={`relative flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold tabular-nums transition-all duration-300
                             ${step.done
                      ? 'bg-emerald-500 text-white shadow-[0_2px_8px_-2px_rgba(16,185,129,0.6)]'
                      : step.active
                        ? 'bg-accent text-white shadow-[0_2px_10px_-2px_rgba(79,70,229,0.7)] ring-4 ring-accent/15'
                        : 'border-2 border-slate-200 bg-white text-slate-400'
                    }`}
                >
                  {step.done ? <CheckCircle2 size={16} /> : step.number}
                </span>
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Step {step.number}
                </span>
                <span
                  className={`text-xs font-bold transition-colors duration-300
                             ${step.done ? 'text-slate-600' : step.active ? 'text-slate-900' : 'text-slate-400'}`}
                >
                  {step.label}
                </span>
              </div>
            </div>
            {!isLast && (
              <span className="mx-2.5 h-px w-6 overflow-hidden rounded-full bg-slate-200 sm:w-10">
                <span
                  className={`block h-full w-full origin-left rounded-full bg-emerald-500 transition-transform duration-500
                             ${step.done ? 'scale-x-100' : 'scale-x-0'}`}
                />
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

function GuidanceBlock({
  validTitle,
  validRules,
  invalidTitle,
  invalidRules,
  invalidExamples,
  correctImage,
  correctAlt,
  tip,
}) {
  return (
    <div className="space-y-2.5">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5">
        <div className="mb-1.5 flex items-center justify-center gap-1.5 text-emerald-700">
          <CheckCircle2 size={16} />
          <h3 className="text-xs font-extrabold uppercase tracking-wide">{validTitle}</h3>
        </div>
        <div className="grid gap-2.5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex min-h-[100px] items-center justify-center rounded-lg border border-emerald-200 bg-white p-2">
            <img src={correctImage} alt={correctAlt} className="max-h-32 w-full rounded-md object-contain" />
          </div>
          <ul className="space-y-1 self-center">
            {validRules.map(rule => <RuleItem key={rule}>{rule}</RuleItem>)}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-red-200 bg-red-50/60 p-2.5">
        <div className="mb-1.5 flex items-center justify-center gap-1.5 text-red-700">
          <XCircle size={16} />
          <h3 className="text-xs font-extrabold uppercase tracking-wide">{invalidTitle}</h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {invalidExamples.map(example => (
            <InvalidExample key={example.src} src={example.src} label={example.label} />
          ))}
        </div>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {invalidRules.map(rule => <RuleItem key={rule} tone="invalid">{rule}</RuleItem>)}
        </ul>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[11px] font-medium leading-relaxed text-blue-900">
        {tip}
      </div>
    </div>
  )
}

function LiveCapture({
  title,
  facingMode,
  active,
  captured,
  onCapture,
  onRetake,
  helper,
  aspectClass = 'aspect-video',
  frameClass = '',
  fitClass = 'object-contain',
}) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraError, setCameraError] = useState('')
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (!active || captured) return undefined

    let cancelled = false

    async function startCamera() {
      setStarting(true)
      setCameraError('')
      try {
        const constraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch {
        if (!cancelled) {
          setCameraError('Camera access is required for live capture. Please allow camera permission and try again.')
        }
      } finally {
        if (!cancelled) setStarting(false)
      }
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Live camera capture is not supported in this browser.')
      return undefined
    }

    startCamera()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }, [active, captured, facingMode])

  const handleCapture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) {
      setCameraError('Camera is still starting. Please try again in a moment.')
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)

    canvas.toBlob((blob) => {
      onCapture({ dataUrl, blob })
    }, 'image/jpeg', 0.92)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-card">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{helper}</p>
        </div>
        {captured && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            <CheckCircle2 size={14} />
            Captured
          </span>
        )}
      </div>

      <div className={`relative mx-auto overflow-hidden rounded-xl border border-slate-200 bg-slate-950 ${frameClass}`}>
        {captured ? (
          <img src={captured.dataUrl} alt={`${title} captured preview`} className={`${aspectClass} w-full ${fitClass}`} />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`${aspectClass} w-full ${fitClass} ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />
            <div className="pointer-events-none absolute inset-4 rounded-xl border border-white/50" />
            {starting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm font-semibold text-white">
                Starting camera...
              </div>
            )}
          </>
        )}
      </div>

      {cameraError && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          {cameraError}
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {captured ? (
          <button
            type="button"
            onClick={onRetake}
            className="flex min-h-[38px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <RefreshCw size={15} />
            Retake
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCapture}
            disabled={!active || starting || Boolean(cameraError)}
            className="flex min-h-[38px] flex-1 items-center justify-center gap-2 rounded-xl bg-navy-800 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Camera size={15} />
            Capture Live
          </button>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}

function StepPanel({ step, title, icon: Icon, children }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="flex items-center gap-2.5 bg-navy-900 px-4 py-2.5 text-white">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white text-navy-900 shadow-sm">
          <Icon size={17} />
        </div>
        <h2 className="text-sm font-extrabold tracking-wide sm:text-base">
          {step}. {title}
        </h2>
      </div>
      <div className="p-3.5">{children}</div>
    </section>
  )
}

export default function ApplicationEntry({ onValidated }) {
  const navigate = useNavigate()
  const [activeStep, setActiveStep] = useState(1)
  const [appId, setAppId] = useState('')
  const [appIdCaptured, setAppIdCaptured] = useState(false)
  const [idProofType, setIdProofType] = useState('')
  const [candidatePhoto, setCandidatePhoto] = useState(null)
  const [idProofCapture, setIdProofCapture] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const appIdDone = appIdCaptured
  const idDone = Boolean(idProofType && idProofCapture)
  const photoDone = Boolean(candidatePhoto)

  // Step 1 — just capture the Application ID (no API call) and move on.
  const handleCaptureAppId = (e) => {
    e.preventDefault()
    const trimmed = appId.trim()
    if (!trimmed) { setError('Please enter your Application ID.'); return }
    setError('')
    setAppIdCaptured(true)
    setActiveStep(2)
  }

  // Step 3 — upload the images under the captured Application ID,
  // then validate the application only if the upload succeeds.
  const handleFinish = async () => {
    const trimmed = appId.trim()
    if (!trimmed) { setError('Please enter your Application ID.'); return }
    if (!idDone || !photoDone) {
      setError('Please capture both your ID proof and candidate photo.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await uploadIdentity(trimmed, candidatePhoto.blob, idProofCapture.blob)

      const res = await validateApplication(trimmed)
      const goToCoding = (res.round || '').startsWith('technical_coding')

      onValidated({
        applicationId:     res.application_id,
        candidateId:       res.candidate_id,
        jobId:             res.job_id,
        candidateName:     res.full_name,
        validated:         res.success,
        applicationStatus: res.round,
        codingEnabled:     res.coding_enabled === true,
        started:           goToCoding,
        idProofType,
      })

      navigate(goToCoding ? '/coding-round' : '/instructions')
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex flex-shrink-0 items-center gap-3 px-6 py-3 sm:px-8">
        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#052e1b] shadow-card">
          <img src="/website_logos/rabbit_logo_without_bg.png" alt="Callohm" className="h-full w-full scale-110 object-contain" />
        </span>
        <div className="flex flex-1 justify-center">
          <Stepper
            steps={[
              { number: '1', label: 'Application ID', done: appIdDone, active: activeStep === 1 },
              { number: '2', label: 'ID Proof', done: idDone, active: activeStep === 2 },
              { number: '3', label: 'Candidate Photo', done: photoDone, active: activeStep === 3 },
            ]}
          />
        </div>
        <span className="hidden h-10 w-10 sm:block" aria-hidden="true" />
      </header>

      <main className="flex flex-1 px-5 py-3 sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col animate-fade-up">
          <div className="mb-3 text-center">
            <h1 className="text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl">
              Candidate Interview Portal
            </h1>
          </div>

          <form onSubmit={handleCaptureAppId} noValidate className="space-y-6">
            {activeStep === 1 && (
              <div className="mx-auto w-full max-w-md animate-fade-up">
                <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
                  <div className="h-1.5 w-full bg-gradient-to-r from-accent via-indigo-500 to-navy-800" />
                  <div className="p-6 sm:p-8">
                    <div className="mb-6 flex flex-col items-center text-center">
                      <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-light text-accent ring-1 ring-accent/20">
                        <IdCard size={26} />
                      </span>
                      <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
                        Enter your Application ID
                      </h2>
                      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500">
                        Next, you&apos;ll capture your ID proof and photo to complete verification.
                      </p>
                    </div>

                    <label htmlFor="appId" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Application ID
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-slate-300">
                        #
                      </span>
                      <input
                        id="appId"
                        type="text"
                        placeholder="app_f53XXXXX"
                        value={appId}
                        onChange={e => { setAppId(e.target.value); setError('') }}
                        autoComplete="off"
                        spellCheck={false}
                        autoFocus
                        disabled={loading}
                        className={`w-full rounded-xl border bg-white py-3 pl-8 pr-4 text-sm font-mono
                                    tracking-wider text-slate-900 outline-none transition-all duration-150
                                    placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400
                                    disabled:cursor-not-allowed disabled:opacity-60
                                    ${error
                            ? 'border-red-400 ring-2 ring-red-100'
                            : 'border-slate-200 focus:border-accent focus:ring-2 focus:ring-accent/15'
                          }`}
                      />
                    </div>
                    {error && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-500">
                        <AlertCircle size={13} />
                        {error}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={!appId.trim()}
                      className="mt-5 flex min-h-[46px] w-full items-center justify-center gap-2.5 rounded-xl bg-navy-800
                                 px-6 py-3 text-sm font-semibold text-white transition-all duration-150
                                 hover:-translate-y-0.5 hover:bg-navy-700 hover:shadow-navy
                                 active:translate-y-0 active:shadow-none
                                 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                    >
                      Continue to ID Proof
                      <ArrowRight size={17} />
                    </button>

                    <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400">
                      <ShieldCheck size={13} />
                      Your information is encrypted and securely handled.
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeStep === 2 && (
              <StepPanel step="2" title="ID Proof Capture" icon={IdCard}>
                <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                  <GuidanceBlock
                    validTitle="Correct ID Photo"
                    validRules={ID_VALID_RULES}
                    invalidTitle="Incorrect ID Photos"
                    invalidRules={ID_INVALID_RULES}
                    invalidExamples={ID_INVALID_EXAMPLES}
                    correctImage="/images/correct_id.png"
                    correctAlt="Correct ID proof example"
                    tip="Ensure all edges are visible, text is readable, and the image is clear."
                  />

                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-card">
                      <label htmlFor="idProofType" className="block text-sm font-semibold text-slate-700">
                        ID Proof Type
                      </label>
                      <select
                        id="idProofType"
                        value={idProofType}
                        onChange={e => { setIdProofType(e.target.value); setError('') }}
                        disabled={loading}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm
                                   text-slate-900 outline-none transition-all duration-150
                                   focus:border-accent focus:ring-2 focus:ring-accent/15
                                   disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="">Select ID proof</option>
                        {ID_PROOF_TYPES.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>

                    <LiveCapture
                      title="Live ID Proof Photo"
                      helper="Use the rear camera when available. Keep the full document inside the frame."
                      facingMode="environment"
                      active={activeStep === 2}
                      captured={idProofCapture}
                      onCapture={(capture) => {
                        setIdProofCapture(capture)
                        setError('')
                      }}
                      onRetake={() => {
                        setIdProofCapture(null)
                        setError('')
                      }}
                    />

                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => { setActiveStep(1); setError('') }}
                        className="flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        disabled={!idDone}
                        onClick={() => { setActiveStep(3); setError('') }}
                        className="flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Continue to Photo
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </StepPanel>
            )}

            {activeStep === 3 && (
              <StepPanel step="3" title="Candidate Photo Capture" icon={Camera}>
                <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                  <GuidanceBlock
                    validTitle="Correct Photo"
                    validRules={PHOTO_VALID_RULES}
                    invalidTitle="Incorrect Photos"
                    invalidRules={PHOTO_INVALID_RULES}
                    invalidExamples={PHOTO_INVALID_EXAMPLES}
                    correctImage="/images/clear_candidate.png"
                    correctAlt="Correct candidate photo example"
                    tip="Make sure your face is clear, well-lit, uncovered, and fully visible."
                  />

                  <div className="mx-auto w-full max-w-[260px] space-y-2.5">
                    <LiveCapture
                      title="Live Candidate Photo"
                      helper="Use the front camera. Keep your face centered inside the frame."
                      facingMode="user"
                      aspectClass="aspect-square"
                      fitClass="object-cover"
                      active={activeStep === 3}
                      captured={candidatePhoto}
                      onCapture={(capture) => {
                        setCandidatePhoto(capture)
                        setError('')
                      }}
                      onRetake={() => {
                        setCandidatePhoto(null)
                        setError('')
                      }}
                    />

                    {error && (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-red-500">
                        <AlertCircle size={13} />
                        {error}
                      </p>
                    )}

                    <div className="grid gap-2.5 sm:grid-cols-[auto_1fr]">
                      <button
                        type="button"
                        onClick={() => { setActiveStep(2); setError('') }}
                        className="flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        disabled={loading || !photoDone}
                        onClick={handleFinish}
                        className="flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            Submit &amp; Continue
                            <ArrowRight size={16} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </StepPanel>
            )}
          </form>

          <p className="mt-3 text-center text-xs text-slate-400">
            Need help?{' '}
            <a href="mailto:support@purviewcallohm.com" className="font-medium text-accent hover:underline">
              support@purviewcallohm.com
            </a>
          </p>
        </div>
      </main>

      <footer className="flex flex-shrink-0 items-center justify-center gap-2.5 px-8 py-2.5">
        <span className="text-xs font-medium text-slate-400">Powered by</span>
        <img src="/purview-logo.png" alt="Purview" className="h-5 w-auto object-contain opacity-70" />
      </footer>
    </div>
  )
}
