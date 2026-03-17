export default function Loading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[50vh]">
      <div className="w-16 h-16 relative flex items-center justify-center mb-6">
        <div className="absolute inset-0 border-4 border-slate-100 dark:border-slate-800 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-transparent border-t-primary rounded-full animate-spin"></div>
        <span className="material-symbols-outlined text-primary text-xl animate-pulse">hub</span>
      </div>
      <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Loading Workspace...</h3>
      <p className="text-slate-500 dark:text-slate-400 text-sm">Please wait while we prepare your dashboard.</p>
    </div>
  )
}
