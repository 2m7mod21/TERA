"use client";

import React, { useState, useTransition } from "react";
import { ClipboardList, Search, RefreshCw, Key } from "lucide-react";
import { getAuditLogs } from "@/server/actions/admin/auditLog";

export default function AuditLogsClient({
  initialLogs,
  initialCursor,
}: {
  initialLogs: any[];
  initialCursor: string | null;
}) {
  const [logs, setLogs] = useState<any[]>(initialLogs);
  const [cursor, setCursor] = useState<string | null>(initialCursor);

  // Filters
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  
  const [isPending, startTransition] = useTransition();

  const handleFetch = (actionVal = action, targetTypeVal = targetType, reset = false) => {
    startTransition(async () => {
      const res = await getAuditLogs({
        action: actionVal || undefined,
        targetType: targetTypeVal || undefined,
        cursor: reset ? undefined : (cursor || undefined),
      });
      if (reset) setLogs(res.logs);
      else setLogs((prev) => [...prev, ...res.logs]);
      setCursor(res.nextCursor);
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">System Audit Trail</h1>
        <p className="text-xs text-slate-500">Immutable operations log of every admin mutation, configuration change, and enforcement.</p>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Filter action (e.g. BAN)..."
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              handleFetch(e.target.value, targetType, true);
            }}
            className="w-full pl-9 pr-4 py-1.5 bg-[#0d0d14] border border-white/5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>

        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            placeholder="Filter target schema (e.g. User)..."
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value);
              handleFetch(action, e.target.value, true);
            }}
            className="w-full px-3 py-1.5 bg-[#0d0d14] border border-white/5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>
      </div>

      {/* Table Logs */}
      <div className="glass border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-white/[0.02]">
                <th className="py-3 px-5">Staff Member</th>
                <th className="py-3 px-5">Command Action</th>
                <th className="py-3 px-5">Target Context</th>
                <th className="py-3 px-5">Old State</th>
                <th className="py-3 px-5">New State</th>
                <th className="py-3 px-5 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No matching audit parameters logged yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.005] transition-colors text-slate-350">
                    <td className="py-3 px-5">
                      <div>
                        <p className="font-bold text-slate-205">@{log.admin?.profile?.username || "legacy_admin"}</p>
                        <p className="text-[9px] text-slate-505">UID: {log.adminId.slice(0, 8)}...</p>
                      </div>
                    </td>
                    <td className="py-3 px-5 font-mono text-[10px] text-violet-400 font-semibold uppercase">{log.action}</td>
                    <td className="py-3 px-5">
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-semibold bg-white/5 border border-white/10 text-slate-400 capitalize">
                        {log.targetType || "Global"}
                      </span>
                      {log.targetId && (
                        <p className="text-[9px] text-slate-500 font-mono mt-0.5">{log.targetId.slice(0, 8)}...</p>
                      )}
                    </td>
                    <td className="py-3 px-5 font-mono text-[9px] text-slate-500 truncate max-w-[120px]">{log.oldValue || "-"}</td>
                    <td className="py-3 px-5 font-mono text-[9px] text-slate-300 truncate max-w-[120px]">{log.newValue || "-"}</td>
                    <td className="py-3 px-5 text-right text-[10px] text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {cursor && (
          <div className="p-4 border-t border-white/5 flex justify-center bg-white/[0.01]">
            <button
              onClick={() => handleFetch(action, targetType, false)}
              className="px-4 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300"
              disabled={isPending}
            >
              {isPending ? "Loading..." : "Load Older Logs"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
