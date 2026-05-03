import { SkeletonCard } from "@/components/shared/skeleton-card";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="h-48 animate-pulse rounded-[2rem] bg-slate-200" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
