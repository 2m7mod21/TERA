"use client";

import React, { useState, useTransition } from "react";
import { Monitor, RefreshCw, Cpu, HardDrive, Clock, Activity } from "lucide-react";
import { getSystemMetrics } from "@/server/actions/admin/system";

type SystemClientProps = {
  metrics: {
    memory: { heapUsedMb: number; heapTotalMb: number; rssMb: number };
    cpu: { userMs: number; systemMs: number };
    dbSizeMb: number;
    osPlatform: string;
    osUptime: number;
    jobs: { pending: number; running: number; done: number; failed: number };
  };
};

export default function SystemClient({ metrics: initialMetrics }: SystemClientProps) {
  const [metrics, setMetrics] = useState(initialMetrics);
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(async () => {
      const res = await getSystemMetrics();
      setMetrics(res);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">System Monitor</h1>
          <p className="text-xs text-slate-500">Real-time status diagnostics of process memory allocations, host environment, and jobs queue.</p>
        </div>

        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold transition-all text-slate-205"
          disabled={isPending}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
          Refresh Stats
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Memory allocation */}
        <div className="glass border border-white/5 p-6 rounded-2xl bg-white/[0.01] space-y-4">
          <h3 className="text-sm font-bold text-slate-350 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-violet-405" /> Memory Diagnostics
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-455">Node Heap Allocated</span>
              <span className="font-bold text-slate-200">{metrics.memory.heapTotalMb} MB</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-455">Node Heap Active</span>
              <span className="font-bold text-slate-200">{metrics.memory.heapUsedMb} MB</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-455">RSS Allocation footprint</span>
              <span className="font-bold text-slate-200">{metrics.memory.rssMb} MB</span>
            </div>

            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
              <div 
                className="bg-violet-500 h-full rounded" 
                style={{ width: `${Math.min(100, (metrics.memory.heapUsedMb / metrics.memory.heapTotalMb) * 100)}%` }} 
              />
            </div>
          </div>
        </div>

        {/* Database info */}
        <div className="glass border border-white/5 p-6 rounded-2xl bg-white/[0.01] space-y-4">
          <h3 className="text-sm font-bold text-slate-350 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-emerald-405" /> Host Machine Profile
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-455">Platform OS</span>
              <span className="font-bold text-slate-200 capitalize">{metrics.osPlatform}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-455">Up Time metrics</span>
              <span className="font-bold text-slate-200">{metrics.osUptime} Hours</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-455">Active SQLite DB File Size</span>
              <span className="font-bold text-slate-200">{metrics.dbSizeMb} MB</span>
            </div>
          </div>
        </div>

        {/* Job Queue */}
        <div className="glass border border-white/5 p-6 rounded-2xl bg-white/[0.01] space-y-4">
          <h3 className="text-sm font-bold text-slate-350 flex items-center gap-2">
            <Activity className="w-4 h-4 text-violet-405" /> Async Job Queue
          </h3>

          <div className="grid grid-cols-2 gap-3 text-center text-xs">
            <div className="p-2 bg-white/[0.02] border border-white/5 rounded-xl">
              <span className="text-[9px] uppercase font-bold text-slate-500">Wait/Pending</span>
              <p className="text-lg font-black text-white mt-0.5">{metrics.jobs.pending}</p>
            </div>
            <div className="p-2 bg-white/[0.02] border border-white/5 rounded-xl">
              <span className="text-[9px] uppercase font-bold text-slate-500">In-Flight</span>
              <p className="text-lg font-black text-blue-400 mt-0.5">{metrics.jobs.running}</p>
            </div>
            <div className="p-2 bg-white/[0.02] border border-white/5 rounded-xl">
              <span className="text-[9px] uppercase font-bold text-slate-500">Successful</span>
              <p className="text-lg font-black text-emerald-450 mt-0.5">{metrics.jobs.done}</p>
            </div>
            <div className="p-2 bg-white/[0.02] border border-white/5 rounded-xl">
              <span className="text-[9px] uppercase font-bold text-slate-500">Failed</span>
              <p className={`text-lg font-black mt-0.5 ${metrics.jobs.failed > 0 ? "text-rose-400 animate-pulse" : "text-slate-400"}`}>
                {metrics.jobs.failed}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
