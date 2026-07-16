"use client";

import React, { useState, useTransition, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  ShieldAlert, CheckCircle, Trash2, Ban, Eye, Search, Filter,
  ChevronDown, RotateCcw, Flag, AlertTriangle, Clock, Users,
  BarChart3, Loader2, UserX, EyeOff, MessageSquare,
  RefreshCw,
} from "lucide-react";
import {
  getReports, getReportsStats, resolveReport, moderateContent, moderateUser,
} from "@/server/actions/admin/reports";

// ── Helpers ───────────────────────────────────────────────────────────────────
const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-500/15 text-red-400 border-red-500/30",
  HIGH:     "bg-orange-500/15 text-orange-400 border-orange-500/30",
  MEDIUM:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  LOW:      "bg-zinc-800 text-zinc-400 border-zinc-700",
};
const STATUS_COLORS: Record<string, string> = {
  PENDING:      "bg-violet-500/15 text-violet-400 border-violet-500/30",
  UNDER_REVIEW: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  RESOLVED:     "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  IGNORED:      "bg-zinc-800 text-zinc-500 border-zinc-700",
  APPEALED:     "bg-amber-500/15 text-amber-400 border-amber-500/30",
};
const CONTENT_ICONS: Record<string, React.ElementType> = {
  POST: MessageSquare,
  COMMENT: MessageSquare,
  USER: Users,
  MESSAGE: MessageSquare,
  STORY: Eye,
  REEL: Eye,
};

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ElementType; color: string }) {
  return (
    <div className="glass rounded-2xl p-4 border border-white/5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="text-2xl font-extrabold text-white">{value}</p>
    </div>
  );
}

function ActionModal({
  title, onConfirm, onClose, requireReason = true,
}: { title: string; onConfirm: (reason: string) => void; onClose: () => void; requireReason?: boolean }) {
  const [reason, setReason] = useState("");
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <h3 className="font-bold text-white">{title}</h3>
        {requireReason && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason / notes (required)..."
            rows={3}
            autoFocus
            className="w-full bg-zinc-900 border border-zinc-800 focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none resize-none"
          />
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-zinc-800 text-sm text-zinc-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { if (!requireReason || reason.trim()) onConfirm(reason); }}
            disabled={requireReason && !reason.trim()}
            className="flex-1 py-2 rounded-xl gradient-btn text-white text-sm font-semibold disabled:opacity-40"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Row actions popover ───────────────────────────────────────────────────────
function ReportRow({ report, onRefresh }: { report: any; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [modal, setModal] = useState<{ type: string; title: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const Icon = CONTENT_ICONS[report.contentType] ?? Flag;
  const reportedUser = report.reportedUser?.profile;
  const reporter = report.reporter?.profile;

  const handleAction = (type: string, reason: string) => {
    setModal(null);
    startTransition(async () => {
      if (type === "IGNORE") {
        await resolveReport(report.id, "IGNORED", reason);
      } else if (type === "RESOLVE") {
        await resolveReport(report.id, "RESOLVED", reason);
      } else if (type === "DELETE_CONTENT") {
        await moderateContent(report.id, "DELETE", reason, report.postId ?? report.contentId);
      } else if (type === "HIDE_CONTENT") {
        await moderateContent(report.id, "HIDE", reason, report.postId ?? report.contentId);
      } else if (type === "WARN_USER") {
        if (report.reportedUserId) await moderateUser(report.id, report.reportedUserId, "WARN", reason, report.category);
      } else if (type === "RESTRICT_USER") {
        if (report.reportedUserId) await moderateUser(report.id, report.reportedUserId, "RESTRICT", reason, report.category);
      } else if (type === "SUSPEND_USER") {
        if (report.reportedUserId) await moderateUser(report.id, report.reportedUserId, "SUSPEND", reason, report.category, 72);
      } else if (type === "BAN_USER") {
        if (report.reportedUserId) await moderateUser(report.id, report.reportedUserId, "BAN", reason, report.category);
      }
      onRefresh();
    });
  };

  return (
    <>
      {modal && (
        <ActionModal
          title={modal.title}
          onConfirm={(r) => handleAction(modal.type, r)}
          onClose={() => setModal(null)}
        />
      )}
      <tr className={`border-t border-white/5 hover:bg-white/[0.015] transition-colors ${isPending ? "opacity-50" : ""}`}>
        <td className="px-4 py-3">
          <span className="font-mono text-[10px] text-zinc-500">{report.id.slice(0, 8).toUpperCase()}</span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Icon className="w-3.5 h-3.5 text-zinc-500" />
            {(report.contentType === "POST" || report.postId) ? (
              <a href={`/post/${report.postId ?? report.contentId}`} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-400 hover:underline">
                View POST
              </a>
            ) : (
              <span className="text-xs text-zinc-300">{report.contentType}</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          {reportedUser ? (
            <div>
              <p className="text-xs font-semibold text-zinc-200">{reportedUser.displayName}</p>
              <p className="text-[10px] text-zinc-500">@{reportedUser.username}</p>
            </div>
          ) : <span className="text-xs text-zinc-600">—</span>}
        </td>
        <td className="px-4 py-3">
          {reporter ? (
            <span className="text-xs text-zinc-400">@{reporter.username}</span>
          ) : <span className="text-xs text-zinc-600">—</span>}
        </td>
        <td className="px-4 py-3">
          <p className="text-xs text-zinc-300 max-w-[120px] truncate">{report.reason}</p>
          <p className="text-[10px] text-zinc-600">{report.category}</p>
        </td>
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${PRIORITY_COLORS[report.priority] ?? PRIORITY_COLORS.LOW}`}>
            {report.priority}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${STATUS_COLORS[report.status] ?? STATUS_COLORS.PENDING}`}>
            {report.status.replace("_", " ")}
          </span>
        </td>
        <td className="px-4 py-3">
          {report.assignedModerator ? (
            <span className="text-[10px] text-zinc-400">@{report.assignedModerator.profile?.username}</span>
          ) : <span className="text-[10px] text-zinc-600">Unassigned</span>}
        </td>
        <td className="px-4 py-3">
          <span className="text-[10px] text-zinc-500">{new Date(report.createdAt).toLocaleDateString()}</span>
        </td>
        <td className="px-4 py-3 relative">
          <button
            ref={btnRef}
            onClick={() => {
              if (btnRef.current) setMenuRect(btnRef.current.getBoundingClientRect());
              setOpen(!open);
            }}
            className="p-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 transition-all"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          
          {open && menuRect && typeof document !== 'undefined' && createPortal(
            <>
              <div className="fixed inset-0 z-[110]" onClick={() => setOpen(false)} />
              <div
                style={{
                  position: 'fixed',
                  top: menuRect.bottom + 4,
                  left: menuRect.right - 208, // 52rem width ≈ 208px
                  zIndex: 111,
                }}
                className="w-52 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl py-1.5 text-left overflow-hidden animate-fade-in"
              >
                <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600">Report Actions</div>
                <button onClick={() => { setOpen(false); setModal({ type: "RESOLVE", title: "Resolve this report?" }); }} className="w-full px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Mark Resolved
                </button>
                <button onClick={() => { setOpen(false); setModal({ type: "IGNORE", title: "Dismiss this report?" }); }} className="w-full px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-2">
                  <RotateCcw className="w-3.5 h-3.5 text-zinc-400" /> Dismiss / Ignore
                </button>
                {(report.postId || report.contentType === "POST") && (
                  <>
                    <div className="my-1 border-t border-zinc-800" />
                    <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600">Content</div>
                    <button onClick={() => { setOpen(false); setModal({ type: "DELETE_CONTENT", title: "Delete this content?" }); }} className="w-full px-3 py-2 text-xs text-rose-400 hover:bg-zinc-800 flex items-center gap-2">
                      <Trash2 className="w-3.5 h-3.5" /> Delete Content
                    </button>
                    <button onClick={() => { setOpen(false); setModal({ type: "HIDE_CONTENT", title: "Hide this content?" }); }} className="w-full px-3 py-2 text-xs text-orange-400 hover:bg-zinc-800 flex items-center gap-2">
                      <EyeOff className="w-3.5 h-3.5" /> Hide Content
                    </button>
                  </>
                )}
                {report.reportedUserId && (
                  <>
                    <div className="my-1 border-t border-zinc-800" />
                    <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600">User Actions</div>
                    <button onClick={() => { setOpen(false); setModal({ type: "WARN_USER", title: "Send warning to user?" }); }} className="w-full px-3 py-2 text-xs text-yellow-400 hover:bg-zinc-800 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5" /> Warn User
                    </button>
                    <button onClick={() => { setOpen(false); setModal({ type: "RESTRICT_USER", title: "Restrict user features?" }); }} className="w-full px-3 py-2 text-xs text-orange-400 hover:bg-zinc-800 flex items-center gap-2">
                      <UserX className="w-3.5 h-3.5" /> Restrict Account
                    </button>
                    <button onClick={() => { setOpen(false); setModal({ type: "SUSPEND_USER", title: "Suspend user for 72 hours?" }); }} className="w-full px-3 py-2 text-xs text-red-400 hover:bg-zinc-800 flex items-center gap-2">
                      <Ban className="w-3.5 h-3.5" /> Suspend (72h)
                    </button>
                    <button onClick={() => { setOpen(false); setModal({ type: "BAN_USER", title: "⚠️ Permanently ban this user?" }); }} className="w-full px-3 py-2 text-xs text-red-500 hover:bg-zinc-800 flex items-center gap-2">
                      <Ban className="w-3.5 h-3.5" /> Permanent Ban
                    </button>
                  </>
                )}
              </div>
            </>,
            document.body
          )}
        </td>
      </tr>
    </>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ReportsClient({
  initialReports,
  initialCursor,
  initialStats,
}: {
  initialReports: any[];
  initialCursor: string | null;
  initialStats: any;
}) {
  const [reports, setReports] = useState<any[]>(initialReports);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [stats, setStats] = useState(initialStats);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [contentTypeFilter, setContentTypeFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const refresh = useCallback((reset = true) => {
    startTransition(async () => {
      const [newData, newStats] = await Promise.all([
        getReports({
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
          contentType: contentTypeFilter || undefined,
          search: searchQuery || undefined,
          cursor: reset ? undefined : (cursor ?? undefined),
        }),
        getReportsStats(),
      ]);
      if (reset) setReports(newData.reports);
      else setReports((prev) => [...prev, ...newData.reports]);
      setCursor(newData.nextCursor);
      setStats(newStats);
    });
  }, [statusFilter, priorityFilter, contentTypeFilter, searchQuery, cursor]);

  const applyFilters = () => refresh(true);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" /> Reports & Moderation
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">Enterprise moderation queue — review, investigate, and take action.</p>
        </div>
        <button onClick={() => refresh(true)} disabled={isPending} className="p-2 rounded-xl border border-zinc-800 text-zinc-500 hover:text-white transition-colors">
          <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCard label="Total" value={stats.total} icon={BarChart3} color="bg-zinc-800 text-zinc-400" />
          <StatCard label="Pending" value={stats.pending} icon={Clock} color="bg-violet-500/20 text-violet-400" />
          <StatCard label="Under Review" value={stats.underReview} icon={Eye} color="bg-blue-500/20 text-blue-400" />
          <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle} color="bg-emerald-500/20 text-emerald-400" />
          <StatCard label="Critical" value={stats.critical} icon={AlertTriangle} color="bg-red-500/20 text-red-400" />
          <StatCard label="Today" value={stats.today} icon={Flag} color="bg-orange-500/20 text-orange-400" />
          <StatCard label="Avg. Hours" value={stats.avgResolution} icon={Clock} color="bg-zinc-800 text-zinc-400" />
        </div>
      )}

      {/* Filters */}
      <div className="glass border border-white/5 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder="Search reports..."
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-violet-500 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-200 outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${showFilters ? "bg-violet-500/10 border-violet-500/30 text-violet-300" : "border-zinc-800 text-zinc-500 hover:text-white"}`}
          >
            <Filter className="w-3.5 h-3.5" /> Filters
          </button>
          <button onClick={applyFilters} disabled={isPending} className="px-4 py-2 rounded-xl gradient-btn text-white text-xs font-semibold flex items-center gap-1.5">
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Search
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-white/5">
            {[
              { label: "Status", value: statusFilter, onChange: setStatusFilter, options: ["", "PENDING", "UNDER_REVIEW", "RESOLVED", "IGNORED", "APPEALED"] },
              { label: "Priority", value: priorityFilter, onChange: setPriorityFilter, options: ["", "CRITICAL", "HIGH", "MEDIUM", "LOW"] },
              { label: "Content Type", value: contentTypeFilter, onChange: setContentTypeFilter, options: ["", "POST", "COMMENT", "MESSAGE", "USER", "STORY", "REEL"] },
            ].map((f) => (
              <div key={f.label}>
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1 block">{f.label}</label>
                <select
                  value={f.value}
                  onChange={(e) => f.onChange(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 outline-none"
                >
                  {f.options.map((o) => <option key={o} value={o}>{o || "All"}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="glass border border-white/5 rounded-2xl overflow-hidden">
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckCircle className="w-8 h-8 text-emerald-500 mb-2 opacity-40" />
            <p className="text-xs text-zinc-500">No reports match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.01]">
                  {["ID", "Type", "Reported", "Reporter", "Reason", "Priority", "Status", "Moderator", "Date", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-zinc-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <ReportRow key={report.id} report={report} onRefresh={() => refresh(true)} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {cursor && (
          <div className="p-4 border-t border-white/5 flex justify-center">
            <button
              onClick={() => refresh(false)}
              disabled={isPending}
              className="px-4 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-xs font-bold text-zinc-300 flex items-center gap-2"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Load More Reports
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
