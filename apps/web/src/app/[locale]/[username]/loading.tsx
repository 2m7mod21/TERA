"use client";

import { SkeletonPost } from "@/components/SkeletonFeed";

export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 mobile-pb-nav">
      {/* Cover Photo Skeleton */}
      <div className="relative h-40 sm:h-64 md:h-80 w-full bg-zinc-900 overflow-hidden animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent" />
      </div>

      {/* Profile Header Skeleton */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="relative flex flex-col sm:flex-row sm:items-end gap-3 -mt-12 sm:-mt-20 pb-6 border-b border-zinc-800 animate-pulse">
          {/* Avatar Skeleton */}
          <div className="relative flex-shrink-0">
            <div className="w-24 h-24 sm:w-36 sm:h-36 rounded-full border-4 border-zinc-950 bg-zinc-900 overflow-hidden shadow-2xl" />
          </div>

          {/* Info Skeletons */}
          <div className="flex-1 md:pb-2 space-y-3">
            <div className="h-7 w-48 bg-zinc-900 rounded" />
            <div className="h-4 w-32 bg-zinc-900 rounded" />
            <div className="h-4 w-6 -ms-2 bg-transparent" />
            <div className="h-4 w-64 bg-zinc-900 rounded mt-2" />
            <div className="flex gap-4 mt-3">
              <div className="h-5 w-16 bg-zinc-900 rounded" />
              <div className="h-5 w-16 bg-zinc-900 rounded" />
              <div className="h-5 w-16 bg-zinc-900 rounded" />
            </div>
          </div>

          {/* Action buttons skeleton */}
          <div className="flex items-center gap-2 sm:pb-2 flex-shrink-0">
            <div className="h-9 w-28 bg-zinc-900 rounded-xl" />
            <div className="h-9 w-24 bg-zinc-900 rounded-xl" />
          </div>
        </div>

        {/* Tab bar skeleton */}
        <div className="flex items-center gap-6 border-b border-zinc-800 py-4 overflow-x-auto hide-scrollbar">
          <div className="h-5 w-16 bg-zinc-900 rounded" />
          <div className="h-5 w-16 bg-zinc-900 rounded" />
          <div className="h-5 w-16 bg-zinc-900 rounded" />
          <div className="h-5 w-16 bg-zinc-900 rounded" />
        </div>

        {/* Content list skeleton */}
        <div className="py-6 space-y-4 max-w-xl mx-auto">
          {Array.from({ length: 2 }).map((_, i) => (
            <SkeletonPost key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
