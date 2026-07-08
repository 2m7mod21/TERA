"use client";

import React, { useState, useTransition } from "react";
import { Bot, Shield, ShieldAlert, Cpu } from "lucide-react";
import { getModerationQueue, moderationDecision } from "@/server/actions/admin/reports";
import { updateSetting } from "@/server/actions/admin/settings";

export default function AiModerationClient({
  initialItems,
  initialCursor,
  threshold,
}: {
  initialItems: any[];
  initialCursor: string | null;
  threshold: number;
}) {
  const [items, setItems] = useState<any[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [activeThreshold, setActiveThreshold] = useState(threshold);
  const [isPending, startTransition] = useTransition();

  const handleFetch = (reset = false) => {
    startTransition(async () => {
      const res = await getModerationQueue(reset ? undefined : (cursor || undefined));
      if (reset) setItems(res.items);
      else setItems((prev) => [...prev, ...res.items]);
      setCursor(res.nextCursor);
    });
  };

  const handleDecision = (itemId: string, decision: "APPROVE" | "BLOCK" | "DELETE" | "WARN") => {
    startTransition(async () => {
      const res = await moderationDecision(itemId, decision);
      if (res.success) handleFetch(true);
    });
  };

  const handleConfigUpdate = () => {
    startTransition(async () => {
      await updateSetting("moderation.aiRiskThreshold", activeThreshold);
      alert(`AI Moderation trigger threshold updated to ${activeThreshold}%`);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">AI Moderation</h1>
          <p className="text-xs text-slate-500">Monitor automatically flags and risk assessments computed by local model layers.</p>
        </div>

        {/* Configuration settings directly editable here */}
        <div className="glass border border-white/5 p-4 rounded-xl bg-white/[0.01] flex items-center gap-3">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">AI Flags Margin</span>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="range"
                min="10"
                max="95"
                value={activeThreshold}
                onChange={(e) => setActiveThreshold(Number(e.target.value))}
                className="w-24 accent-violet-500"
              />
              <span className="text-xs font-bold text-slate-205">{activeThreshold}% Risk</span>
            </div>
          </div>
          <button
            onClick={handleConfigUpdate}
            className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-750 text-xs font-bold text-white transition-colors"
          >
            Apply Margin
          </button>
        </div>
      </div>

      <div className="glass border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
        <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center gap-2">
          <Bot className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-bold text-slate-350">Unresolved AI Flagged Submissions</h3>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Cpu className="w-8 h-8 text-slate-700 mb-2 opacity-50" />
            <p className="text-xs text-slate-500">Zero matches. AI classifier signals everything as within normal safety bounds.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {items.map((item) => (
              <div key={item.id} className="p-5 flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-2.5 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-500/10 border border-violet-500/20 text-violet-400 capitalize">
                      {item.flagType}
                    </span>
                    <span className="text-xs font-bold text-rose-400">{(item.riskScore * 100).toFixed(0)}% AI Confidence Match</span>
                  </div>

                  <p className="text-xs text-slate-300 italic">"{item.content}"</p>
                  <p className="text-[10px] text-slate-500">Node item reference id: {item.sourceId} · Created {new Date(item.createdAt).toLocaleDateString()}</p>
                </div>

                <div className="flex items-center gap-1.5 md:self-center">
                  <button
                    onClick={() => handleDecision(item.id, "APPROVE")}
                    className="px-2.5 py-1.5 rounded bg-[#0d0d14] border border-white/5 text-slate-400 hover:text-slate-200 text-[11px] font-semibold"
                    disabled={isPending}
                  >
                    Clear/Approve
                  </button>

                  <button
                    onClick={() => handleDecision(item.id, "BLOCK")}
                    className="px-2.5 py-1.5 rounded bg-amber-955/20 border border-amber-900/30 text-amber-350 hover:bg-amber-900/30 text-[11px] font-semibold"
                    disabled={isPending}
                  >
                    Flag/Block
                  </button>

                  <button
                    onClick={() => handleDecision(item.id, "DELETE")}
                    className="px-2.5 py-1.5 rounded bg-rose-955/20 border border-rose-900/30 text-rose-350 hover:bg-rose-900/30 text-[11px] font-semibold"
                    disabled={isPending}
                  >
                    Force Purge
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {cursor && (
          <div className="p-4 border-t border-white/5 flex justify-center bg-white/[0.01]">
            <button
              onClick={() => handleFetch(false)}
              className="px-4 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300"
              disabled={isPending}
            >
              {isPending ? "Loading..." : "Load More AI Flags"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
