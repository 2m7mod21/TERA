"use client";

import React, { useState, useTransition } from "react";
import { Landmark } from "lucide-react";
import { getTransactions } from "@/server/actions/admin/monetization";

type MonetizationClientProps = {
  revenue: {
    todayRevenue: number;
    monthRevenue: number;
    totalRevenue: number;
    activeSubs: number;
  };
  initialTips: any[];
  initialCursor: string | null;
};

export default function MonetizationClient({ revenue, initialTips, initialCursor }: MonetizationClientProps) {
  const [tips, setTips] = useState<any[]>(initialTips);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [isPending, startTransition] = useTransition();

  const handleFetch = () => {
    startTransition(async () => {
      const res = await getTransactions(cursor || undefined);
      setTips((prev) => [...prev, ...res.tips]);
      setCursor(res.nextCursor);
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Monetization & Revenue</h1>
        <p className="text-xs text-slate-500">Track tips, subscription values, payouts processing, and fee splits.</p>
      </div>

      {/* Revenue Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass border border-white/5 p-5 rounded-2xl bg-white/[0.01]">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Estimated Income Today</span>
          <p className="text-2xl font-black text-white mt-1">${revenue.todayRevenue.toFixed(2)}</p>
        </div>

        <div className="glass border border-white/5 p-5 rounded-2xl bg-white/[0.01]">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Monthly Yield Accumulated</span>
          <p className="text-2xl font-black text-emerald-400 mt-1">${revenue.monthRevenue.toFixed(2)}</p>
        </div>

        <div className="glass border border-white/5 p-5 rounded-2xl bg-white/[0.01]">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">All-Time Platform Cut</span>
          <p className="text-2xl font-black text-white mt-1">${revenue.totalRevenue.toFixed(2)}</p>
        </div>

        <div className="glass border border-white/5 p-5 rounded-2xl bg-white/[0.01]">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Active Paid Subscriptions</span>
          <p className="text-2xl font-black text-indigo-400 mt-1">{revenue.activeSubs}</p>
        </div>
      </div>

      {/* Transactions list */}
      <div className="glass border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
        <div className="p-4 border-b border-white/5 bg-white/[0.02]">
          <h3 className="text-sm font-bold text-slate-300">Transaction History Database</h3>
        </div>

        {tips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Landmark className="w-8 h-8 text-slate-700 mb-2" />
            <p className="text-xs text-slate-500">No transaction logs recorded in system database.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {tips.map((tip) => (
              <div key={tip.id} className="p-4 flex items-center justify-between text-xs hover:bg-white/[0.005] transition-colors">
                <div>
                  <p className="font-bold text-slate-205">
                    @{tip.sender?.profile?.username} → @{tip.receiver?.profile?.username}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    ID: {tip.id} · {new Date(tip.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-400 text-sm">+${tip.amount.toFixed(2)}</p>
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest">Completed</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {cursor && (
          <div className="p-4 border-t border-white/5 flex justify-center bg-white/[0.01]">
            <button
              onClick={handleFetch}
              className="px-4 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300"
              disabled={isPending}
            >
              {isPending ? "Loading..." : "Load More Activity"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
