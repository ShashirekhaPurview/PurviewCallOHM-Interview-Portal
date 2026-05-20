export default function SessionComplete() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50
                    flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-card-xl max-w-lg w-full p-10 text-center
                      animate-fade-up border border-slate-100">

        {/* Top emoji */}
        <div className="text-6xl mb-6 select-none">🎉</div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200
                        rounded-full px-4 py-1.5 mb-5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-bold text-green-700 uppercase tracking-widest">
            Interview Submitted
          </span>
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
          <a href="mailto:support@purviewcallohm.com"
            className="text-accent hover:underline font-medium">
            support@purviewcallohm.com
          </a>
        </p>
      </div>
    </div>
  )
}
