export default function LoadingCommunity() {
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="h-48 animate-pulse rounded-3xl bg-slate-200" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="h-24 animate-pulse bg-white" />
            <div className="h-80 animate-pulse bg-slate-200" />
          </div>
        ))}
      </div>
    </main>
  )
}
