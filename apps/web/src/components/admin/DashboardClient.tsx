"use client";

import React, { useTransition } from "react";
import { 
  Users, 
  FileText, 
  TrendingUp, 
  ShieldAlert, 
  Clock, 
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { refreshPlatformStats } from "@/server/actions/admin/dashboard";

type DashboardClientProps = {
  stats: Record<string, number>;
  attentionItems: any[];
  chartData: { date: string; signups: number; posts: number }[];
};

export default function DashboardClient({ stats, attentionItems, chartData }: DashboardClientProps) {
  const [isPending, startProgress] = useTransition();

  const handleRefresh = () => {
    startProgress(async () => {
      await refreshPlatformStats();
      window.location.reload();
    });
  };

  const statCards = [
    { label: "Total Users", val: stats.total_users ?? 0, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-550/20" },
    { label: "Total Posts", val: stats.total_posts ?? 0, icon: FileText, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-550/20" },
    { label: "Est. Revenue (Cut)", val: `$${(stats.platform_revenue ?? 0).toFixed(2)}`, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-555/20" },
    { label: "Pending Reports", val: stats.pending_reports ?? 0, icon: ShieldAlert, color: (stats.pending_reports ?? 0) > 0 ? "text-rose-400 animate-pulse" : "text-slate-400", bg: "bg-rose-500/10 border-rose-550/20" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Dashboard Overview</h1>
          <p className="text-xs text-slate-500">Live platform metrics from the cached data engine.</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold transition-all text-slate-200"
          disabled={isPending}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
          {isPending ? "Syncing..." : "Sync Stats Cache"}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className={`glass border p-5 rounded-2xl ${card.bg}`}>
              <div className="flex justify-between items-start">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{card.label}</span>
                <Icon className={`w-4.5 h-4.5 ${card.color}`} />
              </div>
              <p className="text-2xl font-black text-white mt-3">{card.val}</p>
            </div>
          );
        })}
      </div>

      {/* Content split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 glass border border-white/5 p-6 rounded-2xl bg-white/[0.02]">
          <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-violet-400" /> Platform Growth Velocity (Past 30 Days)
          </h3>
          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 border border-white/5 border-dashed rounded-xl">
              <Clock className="w-8 h-8 text-slate-650 opacity-20 mb-2" />
              <p className="text-xs text-slate-500">No chart data found during this window.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {chartData.map((d) => (
                <div key={d.date} className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400">
                    <span>{d.date}</span>
                    <span>
                      {d.signups} Daily Signups • {d.posts} Daily Posts
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden flex gap-0.5">
                    <div className="bg-blue-500 rounded-l" style={{ width: `${Math.max(2, Math.min(100, d.signups * 4))}%` }} />
                    <div className="bg-violet-500 rounded-r" style={{ width: `${Math.max(2, Math.min(100, d.posts * 2))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Needs attention */}
        <div className="glass border border-white/5 p-6 rounded-2xl bg-white/[0.02] flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" /> Moderation Alerts Queue
            </h3>
            {attentionItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-xs text-slate-500">Excellent! Zero high-priority reports pending.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {attentionItems.map((item) => (
                  <div key={item.id} className="p-3 bg-white/[0.03] border border-white/5 rounded-xl text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-rose-400 uppercase tracking-wider text-[8px] bg-rose-500/10 px-1.5 py-0.5 rounded">
                        {item.reason}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {item.post && (
                      <p className="text-slate-300 italic truncate">"{item.post.content}"</p>
                    )}
                    <p className="text-[10px] text-slate-500">
                      Reported by @{item.reporter?.profile?.username ?? "unknown"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
