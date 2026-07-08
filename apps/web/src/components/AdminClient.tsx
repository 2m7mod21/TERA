"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  ShieldAlert, Users, FileText, Check, X, Shield,
  TrendingUp, Activity, BarChart3, CheckCircle2,
} from "lucide-react";
import {
  toggleAdminStatus,
  toggleVerificationBadge,
  resolveReport,
  blockOrWarnUser,
} from "@/server/actions/admin";

export default function AdminClient({
  stats,
  users: initialUsers,
  reports: initialReports,
  chartData,
}: {
  stats: any;
  users: any[];
  reports: any[];
  chartData: any[];
}) {
  const [users, setUsers] = useState<any[]>(initialUsers);
  const [reports, setReports] = useState<any[]>(initialReports);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "moderation">("overview");

  const [isPending, startTransition] = useTransition();

  const handleToggleAdmin = (userId: string) => {
    startTransition(async () => {
      const res = await toggleAdminStatus(userId);
      if (res.success && res.user) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isAdmin: res.user.isAdmin } : u)));
      }
    });
  };

  const handleToggleVerify = (userId: string) => {
    startTransition(async () => {
      const res = await toggleVerificationBadge(userId);
      if (res.success && res.user) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, verifiedBadge: res.user.verifiedBadge } : u)));
      }
    });
  };

  const handleModerateReport = (reportId: string, decision: "RESOLVED" | "IGNORED") => {
    startTransition(async () => {
      const res = await resolveReport(reportId, decision);
      if (res.success) {
        setReports((prev) => prev.filter((r) => r.id !== reportId));
      }
    });
  };

  const handleUserLock = (userId: string, action: "SUSPEND" | "BAN" | "UNBAN" | "UNSUSPEND") => {
    if (!confirm(`Are you sure you want to trigger this action: "${action}"?`)) return;
    startTransition(async () => {
      const res = await blockOrWarnUser(userId, action);
      if (res.success) {
        setUsers((prev) => prev.map((u) => {
          if (u.id === userId) {
            return {
              ...u,
              isSuspended: action === "SUSPEND" ? true : action === "UNSUSPEND" ? false : u.isSuspended,
              isBanned: action === "BAN" ? true : action === "UNBAN" ? false : u.isBanned,
            };
          }
          return u;
        }));
      }
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">← Feed</Link>
            <h1 className="text-2xl font-bold gradient-text mt-1 flex items-center gap-2">
              <Shield className="w-6 h-6" /> Admin Control Cabinet
            </h1>
          </div>
        </div>

        {/* Top metrics quick panel */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Members", val: stats.totalUsers, icon: Users, color: "text-blue-400" },
            { label: "Total Posts", val: stats.totalPosts, icon: FileText, color: "text-indigo-400" },
            { label: "Est. Income (Cut)", val: `$${(stats.totalPlatformRevenue || 0).toFixed(2)}`, icon: TrendingUp, color: "text-emerald-400" },
            { label: "Reports Queue", val: reports.length, icon: ShieldAlert, color: reports.length > 0 ? "text-rose-400 animate-pulse font-bold" : "text-zinc-500" },
          ].map((card, idx) => {
            const Icon = card.icon;
            return (
              <div key={idx} className="glass border border-zinc-900 p-5 rounded-2xl">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">{card.label}</span>
                  <Icon className={`w-4.5 h-4.5 ${card.color}`} />
                </div>
                <p className="text-2xl font-black text-zinc-100 mt-2">{card.val}</p>
              </div>
            );
          })}
        </div>

        {/* Tab menu */}
        <div className="flex gap-1 mb-6 bg-zinc-900/60 p-1.5 rounded-2xl max-w-md">
          {[
            { id: "overview", label: "Analytics Overview", icon: BarChart3 },
            { id: "users", label: `Users (${users.length})`, icon: Users },
            { id: "moderation", label: `Mod Queue (${reports.length})`, icon: ShieldAlert },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === t.id ? "gradient-btn text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {isPending && (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Tab contents */}
        {!isPending && (
          <div>
            {/* Overview tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="glass border border-zinc-900 p-6 rounded-3xl">
                  <h3 className="text-sm font-bold text-zinc-400 mb-4 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-violet-400" /> Platform Velocity (Past 7 Days Events)
                  </h3>
                  {chartData.length === 0 ? (
                    <p className="text-xs text-zinc-650 text-center py-12">No event records found during this window.</p>
                  ) : (
                    <div className="space-y-4">
                      {chartData.map((d: any) => (
                        <div key={d.date} className="space-y-1">
                          <div className="flex justify-between items-center text-xs font-semibold">
                            <span className="text-zinc-450">{d.date}</span>
                            <span className="text-zinc-500">
                              {d.signups} logins • {d.posts} posts • {d.actions} client clicks
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden flex gap-0.5">
                            <div className="bg-emerald-500 rounded-l" style={{ width: `${Math.max(5, Math.min(100, d.signups * 10))}%` }} />
                            <div className="bg-blue-500" style={{ width: `${Math.max(5, Math.min(100, d.posts * 5))}%` }} />
                            <div className="bg-violet-500 rounded-r" style={{ width: `${Math.max(5, Math.min(100, d.actions * 2))}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Users list tab */}
            {activeTab === "users" && (
              <div className="glass border border-zinc-900 rounded-3xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-900 text-xs font-bold text-zinc-550 uppercase tracking-widest bg-zinc-950/40">
                        <th className="py-4 px-6">User</th>
                        <th className="py-4 px-6">Role</th>
                        <th className="py-4 px-6">Verification</th>
                        <th className="py-4 px-6 text-right">Moderation Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900 text-sm">
                      {users.map((u) => {
                        const prof = u.profile;
                        return (
                          <tr key={u.id} className="hover:bg-zinc-900/10 transition-colors">
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center font-bold text-xs text-white">
                                  {prof?.displayName?.[0] ?? "U"}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold truncate max-w-xs">{prof?.displayName ?? "Member"}</p>
                                  <p className="text-xs text-zinc-600 truncate">@{prof?.username ?? "username"}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <button
                                onClick={() => handleToggleAdmin(u.id)}
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                                  u.isAdmin
                                    ? "bg-violet-550/10 border-violet-550/20 text-violet-400 hover:bg-violet-550/20"
                                    : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:bg-zinc-700"
                                }`}
                              >
                                {u.isAdmin ? "ADMIN" : "MEMBER"}
                              </button>
                            </td>
                            <td className="py-4 px-6">
                              <button
                                onClick={() => handleToggleVerify(u.id)}
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                                  u.verifiedBadge
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                                    : "bg-zinc-850 border-zinc-800 text-zinc-600 hover:text-zinc-550"
                                }`}
                              >
                                {u.verifiedBadge ? "VERIFIED" : "NONE"}
                              </button>
                            </td>
                            <td className="py-4 px-6 text-right space-x-2">
                              {u.isSuspended ? (
                                <button
                                  onClick={() => handleUserLock(u.id, "UNSUSPEND")}
                                  className="px-2.5 py-1 rounded-lg border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all text-xs font-semibold"
                                >
                                  Unsuspend
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleUserLock(u.id, "SUSPEND")}
                                  className="px-2.5 py-1 rounded-lg border border-amber-500/20 text-amber-550 hover:bg-amber-500 hover:text-white transition-all text-xs font-semibold"
                                >
                                  Suspend
                                </button>
                              )}

                              {u.isBanned ? (
                                <button
                                  onClick={() => handleUserLock(u.id, "UNBAN")}
                                  className="px-2.5 py-1 rounded-lg border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all text-xs font-semibold"
                                >
                                  Unban
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleUserLock(u.id, "BAN")}
                                  className="px-2.5 py-1 rounded-lg border border-red-500/20 text-rose-450 hover:bg-red-500 hover:text-white transition-all text-xs font-semibold"
                                >
                                  Ban User
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Moderation queue tab */}
            {activeTab === "moderation" && (
              <div className="space-y-4">
                {reports.length === 0 ? (
                  <div className="glass rounded-3xl p-16 text-center text-zinc-650 border border-zinc-900/80">
                    <CheckCircle2 className="w-12 h-12 opacity-15 mx-auto mb-3 text-emerald-400" />
                    <p className="font-semibold text-zinc-550">Mod Cabinet Clear</p>
                    <p className="text-xs mt-1">There are no pending user flags requiring arbitration.</p>
                  </div>
                ) : (
                  reports.map((rep) => (
                    <div key={rep.id} className="glass border border-zinc-900 p-5 rounded-2xl flex flex-col md:flex-row md:items-start justify-between gap-6">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/15 text-rose-400">
                            {rep.reason}
                          </span>
                          <span className="text-xs text-zinc-600">
                            Reported by @{rep.reporter?.profile?.username ?? "reporter"}
                          </span>
                        </div>
                        {rep.post && (
                          <div className="border-l-2 border-zinc-800 pl-4 py-1 text-sm bg-zinc-950/20 rounded p-2">
                            <p className="text-xs text-zinc-500 font-bold mb-1">Target Post by @{rep.post.user?.profile?.username}</p>
                            <p className="text-zinc-300 italic">"{rep.post.content}"</p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0 self-center">
                        <button
                          onClick={() => handleModerateReport(rep.id, "RESOLVED")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all text-xs font-semibold"
                        >
                          <Check className="w-3.5 h-3.5" /> Resolve Report
                        </button>
                        <button
                          onClick={() => handleModerateReport(rep.id, "IGNORED")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300 transition-all text-xs font-semibold"
                        >
                          <X className="w-3.5 h-3.5" /> Dismiss Flag
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
