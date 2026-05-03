export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
      <div className="h-40 rounded-xl bg-slate-200" />
      <div className="mt-4 h-5 w-2/3 rounded bg-slate-200" />
      <div className="mt-2 h-4 w-1/2 rounded bg-slate-200" />
      <div className="mt-6 h-10 rounded-xl bg-slate-200" />
    </div>
  );
}
