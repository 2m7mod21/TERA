"use client";

import React, { useState, useTransition } from "react";
import { Database, RefreshCw, Key, ShieldAlert } from "lucide-react";
import { getDatabaseInfo } from "@/server/actions/admin/system";

type DatabaseClientProps = {
  tables: { name: string; count: number }[];
};

export default function DatabaseClient({ tables: initialTables }: DatabaseClientProps) {
  const [tables, setTables] = useState(initialTables);
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(async () => {
      const res = await getDatabaseInfo();
      setTables(res.tables);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white font-mono uppercase">Database tables schema</h1>
          <p className="text-xs text-slate-500">Owner security level: view records footprint count per storage model.</p>
        </div>

        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold transition-all text-slate-205"
          disabled={isPending}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
          Refresh Registry counts
        </button>
      </div>

      {/* Tables layout logs */}
      <div className="glass border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
        <div className="p-4 border-b border-white/5 bg-white/[0.02]">
          <h3 className="text-xs font-bold text-slate-350 uppercase tracking-widest font-mono">SQLite Model Registry Row Counts</h3>
        </div>

        <div className="divide-y divide-white/5">
          {tables.map((tbl) => (
            <div key={tbl.name} className="p-4 flex justify-between items-center text-xs hover:bg-white/[0.005]">
              <span className="font-mono text-slate-205 font-bold">{tbl.name}</span>
              <span className="font-bold text-violet-400">{tbl.count.toLocaleString()} rows logged</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
