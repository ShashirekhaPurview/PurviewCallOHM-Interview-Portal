import { ShieldX } from 'lucide-react'

export default function SessionExpired() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-card-xl max-w-md w-full p-10 text-center
                      animate-fade-up border border-slate-100">

        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center
                        mx-auto mb-6">
          <ShieldX size={28} className="text-slate-500" />
        </div>

        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-slate-300" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Session Closed
          </span>
        </div>

        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-3">
          Interview Session Ended
        </h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-8">
          Your interview session has been closed. Since each link is a single-use session,
          this link is no longer valid. The hiring team will be in touch regarding next steps.
        </p>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-8">
          <p className="text-slate-600 text-xs leading-relaxed font-medium">
            Thank you for taking the time to complete your interview with{' '}
            <span className="text-slate-800 font-semibold">Purview Callohm</span>.
            We appreciate your effort and will review your responses carefully.
          </p>
        </div>

        <p className="text-slate-400 text-xs">
          Questions?{' '}
          <a
            href="mailto:support@purviewcallohm.com"
            className="text-accent hover:underline font-medium"
          >
            support@purviewcallohm.com
          </a>
        </p>
      </div>
    </div>
  )
}
