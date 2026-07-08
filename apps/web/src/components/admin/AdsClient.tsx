"use client";

import React, { useState, useTransition } from "react";
import { Megaphone, CheckCircle, XCircle, Pause, Compass, DollarSign } from "lucide-react";
import { getAdCampaigns, approveAd, rejectAd, pauseAd } from "@/server/actions/admin/monetization";

export default function AdsClient({
  initialCampaigns,
  initialCursor,
}: {
  initialCampaigns: any[];
  initialCursor: string | null;
}) {
  const [campaigns, setCampaigns] = useState<any[]>(initialCampaigns);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [isPending, startTransition] = useTransition();

  const handleFetch = (filterVal = statusFilter, reset = false) => {
    startTransition(async () => {
      const res = await getAdCampaigns(filterVal, reset ? undefined : (cursor || undefined));
      if (reset) setCampaigns(res.campaigns);
      else setCampaigns((prev) => [...prev, ...res.campaigns]);
      setCursor(res.nextCursor);
    });
  };

  const handleAction = (campaignId: string, actionFn: (id: string, ...args: any[]) => Promise<any>, ...args: any[]) => {
    if (!confirm("Are you sure?")) return;
    startTransition(async () => {
      const res = await actionFn(campaignId, ...args);
      if (res.success) handleFetch(statusFilter, true);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Ads Manager</h1>
          <p className="text-xs text-slate-500">Approve, reject, pause and track sponsored promotion campaigns.</p>
        </div>

        {/* Filter */}
        <div className="flex gap-2">
          {["PENDING", "ACTIVE", "PAUSED", "REJECTED"].map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                handleFetch(st, true);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${
                statusFilter === st
                  ? "bg-violet-500/15 border-violet-500/30 text-violet-300"
                  : "bg-[#0d0d14] border-white/5 text-slate-450 hover:text-slate-205"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Campaigns list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {campaigns.length === 0 ? (
          <div className="col-span-full glass border border-white/5 p-12 rounded-2xl bg-white/[0.01] flex flex-col items-center justify-center text-center">
            <Megaphone className="w-8 h-8 text-slate-700 mb-2" />
            <p className="text-xs text-slate-500">No campaigns match this status filter.</p>
          </div>
        ) : (
          campaigns.map((camp) => (
            <div key={camp.id} className="glass border border-white/5 p-5 rounded-2xl bg-white/[0.01] space-y-4 hover:border-white/10 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-xs font-bold text-slate-205">{camp.title}</h4>
                  <p className="text-[10px] text-slate-500">ID: {camp.id} · Budget: ${camp.budget.toFixed(2)}</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-white/5 text-slate-400 capitalize">
                  {camp.status}
                </span>
              </div>

              {camp.creative && (
                <p className="text-xs text-slate-400 italic break-all">"{camp.creative}"</p>
              )}

              <div className="border-t border-white/5 pt-3 flex justify-between items-center text-[10px] text-slate-500">
                <span>Start: {new Date(camp.startDate).toLocaleDateString()}</span>
                
                <div className="flex gap-1.5">
                  {camp.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => handleAction(camp.id, approveAd)}
                        className="px-2 py-1 rounded bg-emerald-950/15 border border-emerald-900/25 text-emerald-400 hover:bg-emerald-950/30 text-[10px] font-bold"
                        disabled={isPending}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          const r = prompt("Reason for rejection:");
                          if (r) handleAction(camp.id, rejectAd, r);
                        }}
                        className="px-2 py-1 rounded bg-rose-950/15 border border-rose-900/25 text-rose-400 hover:bg-rose-950/30 text-[10px] font-bold"
                        disabled={isPending}
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {camp.status === "ACTIVE" && (
                    <button
                      onClick={() => handleAction(camp.id, pauseAd)}
                      className="px-2 py-1 rounded bg-amber-955/15 border border-amber-900/25 text-amber-400 hover:bg-amber-950/30 text-[10px] font-bold"
                      disabled={isPending}
                    >
                      Pause
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {cursor && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => handleFetch(statusFilter, false)}
            className="px-4 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-350"
            disabled={isPending}
          >
            {isPending ? "Loading..." : "Load More Ad Campaigns"}
          </button>
        </div>
      )}
    </div>
  );
}
