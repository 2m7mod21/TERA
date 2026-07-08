"use client";

export function SkeletonPost() {
  return (
    <div className="glass-light rounded-2xl overflow-hidden mb-3">
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <div className="skeleton w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3.5 w-32 rounded" />
          <div className="skeleton h-2.5 w-20 rounded" />
        </div>
      </div>
      {/* Content lines */}
      <div className="px-4 pb-3 space-y-2">
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-4/5 rounded" />
        <div className="skeleton h-3 w-3/5 rounded" />
      </div>
      {/* Media placeholder */}
      <div className="skeleton h-52 w-full rounded-none" />
      {/* Actions */}
      <div className="px-4 py-3 flex items-center gap-4">
        <div className="skeleton h-8 w-20 rounded-xl" />
        <div className="skeleton h-8 w-24 rounded-xl" />
        <div className="skeleton h-8 w-16 rounded-xl ml-auto" />
      </div>
    </div>
  );
}

export function SkeletonStories() {
  return (
    <div className="glass-light rounded-2xl p-3 mb-3">
      <div className="flex gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className="skeleton w-16 h-24 rounded-2xl" />
            <div className="skeleton h-2.5 w-12 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonSidebar() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-1">
          <div className="skeleton w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-28 rounded" />
            <div className="skeleton h-2.5 w-20 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
