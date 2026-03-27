'use client';

// ===== 基礎 Skeleton 元件 =====
export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`skeleton-block ${className}`} />;
}

// ===== 首頁旅程卡片 Skeleton =====
export function TripCardSkeleton() {
  return (
    <div className="relative pl-10">
      <div className="absolute left-0 top-6 -translate-x-1/2 w-3 h-3 rounded-full bg-gray-200" />
      <div className="rounded-[2rem] overflow-hidden border border-gray-100">
        <div className="p-6 space-y-4">
          <SkeletonBlock className="h-6 w-3/4 rounded-xl" />
          <SkeletonBlock className="h-3 w-1/2 rounded-lg" />
        </div>
        <SkeletonBlock className="h-48 w-full rounded-none" />
      </div>
    </div>
  );
}

// ===== 行程項目 Skeleton =====
export function ItinerarySkeleton() {
  return (
    <div className="relative pl-32 space-y-12">
      {[1, 2, 3].map(i => (
        <div key={i} className="space-y-2">
          <SkeletonBlock className="h-5 w-24 rounded-lg" />
          <div className="p-6 rounded-[2.5rem] border border-gray-100 space-y-3">
            <SkeletonBlock className="h-6 w-2/3 rounded-xl" />
            <SkeletonBlock className="h-4 w-full rounded-lg" />
            <SkeletonBlock className="h-4 w-1/2 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== 成員列表 Skeleton =====
export function MemberSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2, 3].map(i => (
        <div key={i} className="relative pl-10">
          <div className="absolute left-0 top-6 -translate-x-1/2 w-3 h-3 rounded-full bg-gray-200" />
          <div className="p-5 rounded-2xl border border-gray-100 flex justify-between items-center">
            <div className="space-y-2 flex-1">
              <SkeletonBlock className="h-3 w-12 rounded" />
              <SkeletonBlock className="h-5 w-24 rounded-lg" />
            </div>
            <div className="space-y-2">
              <SkeletonBlock className="h-3 w-12 rounded" />
              <SkeletonBlock className="h-4 w-20 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== 支出列表 Skeleton =====
export function ExpenseSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="p-5 rounded-3xl border border-gray-100 flex justify-between items-center">
          <div className="space-y-2 flex-1">
            <SkeletonBlock className="h-4 w-16 rounded-full" />
            <SkeletonBlock className="h-6 w-32 rounded-lg" />
            <SkeletonBlock className="h-3 w-24 rounded" />
          </div>
          <SkeletonBlock className="h-8 w-16 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
