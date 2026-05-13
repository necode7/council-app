import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-4 text-slate-100">
      <div className="absolute inset-0 hero-glow hero-fade opacity-50" />
      <div className="absolute inset-0 grain opacity-30" />

      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center text-center">
        <p className="eyebrow mb-6">404</p>
        <h1 className="display mb-4 text-5xl text-white sm:text-6xl">
          Page not found
        </h1>
        <p className="mb-10 text-lg text-slate-400">
          This page doesn&apos;t exist or was moved. Your council is still waiting.
        </p>
        <Link
          href="/dashboard"
          className="btn-primary rounded-full px-8 py-3 font-semibold text-white transition"
        >
          Back to Dashboard
        </Link>
      </div>
    </main>
  )
}
