export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="pulse-1 h-2 w-2 rounded-full bg-violet-400" />
          <span className="pulse-2 h-2 w-2 rounded-full bg-violet-400" />
          <span className="pulse-3 h-2 w-2 rounded-full bg-violet-400" />
        </div>
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    </div>
  )
}
