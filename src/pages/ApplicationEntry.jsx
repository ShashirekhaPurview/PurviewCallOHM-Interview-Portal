import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, AlertCircle, ShieldCheck, Loader2 } from 'lucide-react'
import { validateApplication } from '../apis/apiService'

export default function ApplicationEntry({ onValidated }) {
  const navigate = useNavigate()
  const [appId, setAppId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = appId.trim()
    if (!trimmed) { setError('Please enter your Application ID.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await validateApplication(trimmed)

      // `round` tells us exactly where this candidate should go:
      //   "technical"          → AI interview (instructions → assessment)
      //   "technical_coding*"  → skip straight to coding round
      //     (covers technical_coding, technical_coding_inprogress, etc.)
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
      })

      navigate(goToCoding ? '/coding-round' : '/instructions')
    } catch (err) {
      setError(err.message || 'Validation failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── Top Bar ──────────────────────────────────────────────── */}
      <header className="flex-shrink-0 px-8 py-5">
        <img
          src="/callohm-logo.png"
          alt="Callohm"
          className="h-9 w-auto object-contain"
        />
      </header>

      {/* ── Center Card ──────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md animate-fade-up">

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-card-xl border border-slate-100 p-8 sm:p-10">

            {/* Heading */}
            <div className="mb-7 text-center">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">
                Candidate Interview Portal
              </h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                Enter the <span className="font-semibold text-slate-700">Application ID</span> from
                your interview invitation to get started.
              </p>
            </div>

            <div className="h-px bg-slate-100 mb-7" />

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div className="space-y-1.5">
                <label
                  htmlFor="appId"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Application ID
                </label>
                <input
                  id="appId"
                  type="text"
                  placeholder="e.g. app_f53XXXXX"
                  value={appId}
                  onChange={e => { setAppId(e.target.value); setError('') }}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  disabled={loading}
                  className={`w-full px-4 py-3 rounded-xl border text-sm font-mono
                              tracking-wider placeholder:font-normal placeholder:tracking-normal
                              placeholder:text-slate-400 text-slate-900 bg-white
                              transition-all duration-150 outline-none
                              disabled:opacity-60 disabled:cursor-not-allowed
                              ${error
                      ? 'border-red-400 ring-2 ring-red-100'
                      : 'border-slate-200 focus:border-accent focus:ring-2 focus:ring-accent/15'
                    }`}
                />
                {error && (
                  <p className="flex items-center gap-1.5 text-red-500 text-xs font-medium pt-0.5">
                    <AlertCircle size={13} />
                    {error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !appId.trim()}
                className="w-full flex items-center justify-center gap-2.5
                           py-3.5 px-6 rounded-xl font-semibold text-sm text-white
                           bg-navy-800 hover:bg-navy-700 transition-all duration-150
                           disabled:opacity-50 disabled:cursor-not-allowed
                           hover:shadow-navy hover:-translate-y-0.5
                           active:translate-y-0 active:shadow-none"
              >
                {loading ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    Validating…
                  </>
                ) : (
                  <>
                    Validate &amp; Continue
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>

            {/* Trust line */}
            <div className="flex items-center justify-center gap-1.5 mt-6
                            text-slate-400 text-xs">
              <ShieldCheck size={13} />
              Your information is encrypted and securely handled.
            </div>
          </div>

          {/* Help */}
          <p className="text-center text-slate-400 text-xs mt-4">
            Need help?{' '}
            <a
              href="mailto:support@purviewcallohm.com"
              className="text-accent hover:underline font-medium"
            >
              support@purviewcallohm.com
            </a>
          </p>
        </div>
      </main>

      {/* ── Bottom "Powered by" ───────────────────────────────────── */}
      <footer className="flex-shrink-0 flex items-center justify-center gap-2.5 px-8 py-5">
        <span className="text-xs text-slate-400 font-medium">Powered by</span>
        <img
          src="/purview-logo.png"
          alt="Purview"
          className="h-5 w-auto object-contain opacity-70"
        />
      </footer>

    </div>
  )
}
