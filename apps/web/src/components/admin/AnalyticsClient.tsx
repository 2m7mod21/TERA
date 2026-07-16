"use client";

import React, { useState, useTransition } from "react";
import { Compass, Activity, MapPin } from "lucide-react";
import { getAnalytics } from "@/server/actions/admin/analytics";

type AnalyticsClientProps = {
  data: {
    timeline: any[];
    topPosts: any[];
    locations: any[];
  };
  growth: {
    currentPeriod: number;
    prevPeriod: number;
    trend: number;
  };
};

export default function AnalyticsClient({ data, growth }: AnalyticsClientProps) {
  const [timeline, setTimeline] = useState(data.timeline);
  const [topPosts, setTopPosts] = useState(data.topPosts);
  const [locations, setLocations] = useState(data.locations);
  const [range, setRange] = useState<7 | 14 | 30>(30);
  const [, startTransition] = useTransition();

  const handleRangeUpdate = (val: 7 | 14 | 30) => {
    setRange(val);
    startTransition(async () => {
      const res = await getAnalytics(val);
      setTimeline(res.timeline);
      setTopPosts(res.topPosts);
      setLocations(res.locations);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">System Analytics</h1>
          <p className="text-xs text-slate-500">Monitor engagement levels, geographical profiles, and trend indices.</p>
        </div>

        {/* Range selectors */}
        <div className="flex gap-1 bg-[#0d0d14] border border-white/5 p-1 rounded-lg">
          {([7, 14, 30] as const).map((r) => (
            <button
              key={r}
              onClick={() => handleRangeUpdate(r)}
              className={`px-3 py-1 rounded text-[11px] font-bold transition-all ${
                range === r
                  ? "bg-violet-500/15 text-violet-300"
                  : "text-slate-500 hover:text-slate-205"
              }`}
            >
              Last {r} Days
            </button>
          ))}
        </div>
      </div>

      {/* Overview growth cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass border border-white/5 p-5 rounded-2xl bg-white/[0.01]">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">New Members ({range}d)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-black text-white">{growth.currentPeriod}</p>
            <span className={`text-[10px] font-bold ${growth.trend >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {growth.trend >= 0 ? "+" : ""}{growth.trend.toFixed(1)}% vs priority period
            </span>
          </div>
        </div>

        <div className="glass border border-white/5 p-5 rounded-2xl bg-white/[0.01]">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Growth Index status</span>
          <p className="text-2xl font-black text-emerald-400 mt-1">Expansion Phase</p>
        </div>

        <div className="glass border border-white/5 p-5 rounded-2xl bg-white/[0.01]">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Active Node Coverage</span>
          <p className="text-2xl font-black text-white mt-1">100% Operational</p>
        </div>
      </div>

      {/* Grid split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline breakdown */}
        <div className="lg:col-span-2 glass border border-white/5 p-5 rounded-2xl bg-white/[0.01] space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-violet-400" /> Hourly & Daily Interactions Activity
          </h3>

          <div className="space-y-3">
            {timeline.length === 0 ? (
              <p className="text-xs text-slate-500 py-12 text-center">No active stats recorded in database during timeframe.</p>
            ) : (
              timeline.map((t) => (
                <div key={t.date} className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold">
                    <span>{t.date}</span>
                    <span>{t.signups} Signups · {t.posts} Posts · {t.likes} Likes · {t.comments} Comments</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden flex">
                    <div className="bg-blue-500" style={{ width: `${Math.max(1, Math.min(100, t.signups * 10))}%` }} />
                    <div className="bg-violet-500" style={{ width: `${Math.max(1, Math.min(100, t.posts * 5))}%` }} />
                    <div className="bg-indigo-500" style={{ width: `${Math.max(1, Math.min(100, t.likes * 2))}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Geographic location breakdown */}
        <div className="glass border border-white/5 p-5 rounded-2xl bg-white/[0.01] space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Geographic profile distribution
          </h3>

          <div className="space-y-3">
            {locations.length === 0 ? (
              <p className="text-xs text-slate-500 py-12 text-center">No user location data declared.</p>
            ) : (
              locations.map((loc, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-350">{loc.location}</span>
                  <span className="text-[11px] font-bold text-violet-400">{loc._count.location} Members</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top Posts engagement index */}
      <div className="glass border border-white/5 p-5 rounded-2xl bg-white/[0.01]">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-blue-400" /> Engagement Performance Index (Top Posts)
        </h3>

        <div className="divide-y divide-white/5">
          {topPosts.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No post content published in selected timeline range.</p>
          ) : (
            topPosts.map((post) => (
              <div key={post.id} className="py-3 flex justify-between items-center text-xs">
                <div className="truncate max-w-lg pr-4">
                  <p className="text-slate-300 italic truncate">"{post.content}"</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">by @{post.user?.profile?.username ?? "unknown"}</p>
                </div>
                <div className="flex gap-3 text-[10px] font-semibold text-slate-400 flex-shrink-0">
                  <span>{post._count.reactions} Likes</span>
                  <span>{post._count.comments} Comments</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
