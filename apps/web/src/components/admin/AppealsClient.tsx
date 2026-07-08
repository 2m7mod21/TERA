"use client";

import React, { useState, useTransition } from "react";
import { CheckCircle, X, Clock, Loader2, RefreshCw, Gavel } from "lucide-react";
import { getAppeals, reviewAppeal } from "@/server/actions/admin/reports";

const STATUS_COLORS: Record<string, string> = {
  PENDING:  "bg-amber-500/15 text-amber-400 border-amber-500/30",
  APPROVED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  REJECTED: "bg-red-500/15 text-red-400 border-red-500/30",
};

interface ReviewModal {
  appealId: string;
  decision: "APPROVED" | "REJECTED";
}

export default function AppealsClient({
  initialAppeals,
  initialCursor,
}: {
  initialAppeals: any[];
  initialCursor: string | null;
}) {
  const [appeals, setAppeals] = useState<any[]>(initialAppeals);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [statusFilter, setStatusFilter] = useState("");
  const [modal, setModal] = useState<ReviewModal | null>(null);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const refresh = (reset = true) => {
    startTransition(async () => {
      const res = await getAppeals({
        status: statusFilter || undefined,
        cursor: reset ? undefined : (cursor ?? undefined),
      });
      if (reset) setAppeals(res.appeals);
      else setAppeals((prev) => [...prev, ...res.appeals]);
      setCursor(res.nextCursor);
    });
  };

  const handleReview = () => {
    if (!modal || !note.trim()) return;
    startTransition(async () => {
      await reviewAppeal(modal.appealId, modal.decision, note);
      setModal(null);
      setNote("");
      refresh(true);
    });
  };

  return (
    <div className="space-y-6">
      {modal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Gavel className="w-4 h-4 text-violet-400" />
              {modal.decision === "APPROVED" ? "Approve Appeal" : "Reject Appeal"}
            </h3>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter your review note (shown to user)..."
              rows={4}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none resize-none"
            />
            <div className="flex gap-2">
              <button onClick={() => { setModal(null); setNote(""); }} className="flex-1 py-2 rounded-xl border border-zinc-800 text-sm text-zinc-400 hover:text-white">Cancel</button>
              <button
                onClick={handleReview}
                disabled={!note.trim() || isPending}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 ${modal.decision === "APPROVED" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-red-600 hover:bg-red-500 text-white"}`}
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gavel className="w-3.5 h-3.5" />}
                {modal.decision === "APPROVED" ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Gavel className="w-5 h-5 text-violet-400" /> Appeals
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">Review user appeals against moderation actions.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); }}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 outline-none"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <button onClick={() => refresh(true)} disabled={isPending} className="p-2 rounded-xl border border-zinc-800 text-zinc-500 hover:text-white">
            <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {appeals.length === 0 ? (
          <div className="glass border border-white/5 rounded-2xl p-12 text-center">
            <CheckCircle className="w-8 h-8 text-emerald-500 opacity-30 mx-auto mb-2" />
            <p className="text-xs text-zinc-500">No appeals found.</p>
          </div>
        ) : (
          appeals.map((appeal) => (
            <div key={appeal.id} className="glass border border-white/5 rounded-2xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 overflow-hidden flex-shrink-0">
                    {appeal.user?.profile?.avatarUrl ? (
                      <img src={appeal.user.profile.avatarUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                        {appeal.user?.profile?.displayName?.[0] ?? "?"}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-200">{appeal.user?.profile?.displayName ?? "User"}</p>
                    <p className="text-xs text-zinc-500">@{appeal.user?.profile?.username} · {new Date(appeal.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase border flex-shrink-0 ${STATUS_COLORS[appeal.status]}`}>
                  {appeal.status}
                </span>
              </div>

              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Violation</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-zinc-300">{appeal.violation?.violationType}</span>
                  <span className="text-[9px] text-zinc-600 font-mono">Strike #{appeal.violation?.strikeNumber}</span>
                  <span className="text-[9px] text-zinc-600">{appeal.violation?.actionTaken}</span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Appeal Reason</p>
                <p className="text-xs text-zinc-300">{appeal.reason}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Explanation</p>
                <p className="text-xs text-zinc-400 leading-relaxed">{appeal.explanation}</p>
              </div>

              {appeal.status === "PENDING" && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setModal({ appealId: appeal.id, decision: "APPROVED" })}
                    className="flex-1 py-2 rounded-xl bg-emerald-600/10 border border-emerald-600/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-600/20 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Approve Appeal
                  </button>
                  <button
                    onClick={() => setModal({ appealId: appeal.id, decision: "REJECTED" })}
                    className="flex-1 py-2 rounded-xl bg-red-600/10 border border-red-600/20 text-red-400 text-xs font-semibold hover:bg-red-600/20 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" /> Reject Appeal
                  </button>
                </div>
              )}

              {appeal.status !== "PENDING" && appeal.reviewNote && (
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1">Review Note</p>
                  <p className="text-xs text-zinc-400">{appeal.reviewNote}</p>
                  <p className="text-[10px] text-zinc-600 mt-1">by @{appeal.reviewer?.profile?.username} · {new Date(appeal.reviewedAt).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {cursor && (
        <div className="flex justify-center">
          <button onClick={() => refresh(false)} disabled={isPending} className="px-4 py-2 rounded-xl border border-zinc-800 text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-2">
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />} Load More
          </button>
        </div>
      )}
    </div>
  );
}
