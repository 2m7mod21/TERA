"use client";

import React, { useState, useTransition } from "react";
import { Shield, Key, EyeOff, Ban, Plus, Trash2, Landmark } from "lucide-react";
import { addBlockedIP, removeBlockedIP, terminateSession } from "@/server/actions/admin/security";

export default function SecurityClient({
  failedLogins,
  blockedIPs: initialBlockedIPs,
  activeSessions: initialSessions,
}: {
  failedLogins: any[];
  blockedIPs: any[];
  activeSessions: any[];
}) {
  const [blockedIPs, setBlockedIPs] = useState<any[]>(initialBlockedIPs);
  const [sessions, setSessions] = useState<any[]>(initialSessions);
  const [ipInput, setIpInput] = useState("");
  const [ipReason, setIpReason] = useState("");
  
  const [isPending, startTransition] = useTransition();

  const handleAddIP = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipInput) return;
    startTransition(async () => {
      const res = await addBlockedIP(ipInput, ipReason || undefined);
      if (res.success) {
        alert(`IP '${ipInput}' blocked successfully.`);
        window.location.reload();
      }
    });
  };

  const handleRemoveIP = (id: string) => {
    if (!confirm("Are you sure you want to remove this IP from target access ban list?")) return;
    startTransition(async () => {
      const res = await removeBlockedIP(id);
      if (res.success) {
        alert("IP ban revoked.");
        window.location.reload();
      }
    });
  };

  const handleTerminate = (sessionId: string) => {
    if (!confirm("Force terminate this user active session?")) return;
    startTransition(async () => {
      const res = await terminateSession(sessionId);
      if (res.success) {
        alert("Session terminated.");
        window.location.reload();
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Security Center</h1>
        <p className="text-xs text-slate-500">Track failed access attempts, block IP subnets, and revoke active member sessions.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessions & failed login */}
        <div className="lg:col-span-2 space-y-6">
          {/* Failed signins */}
          <div className="glass border border-white/5 p-5 rounded-2xl bg-white/[0.01] space-y-4">
            <h3 className="text-sm font-bold text-slate-350 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-violet-405" /> Audit Flag: Access Violations
            </h3>

            {failedLogins.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">Zero failed access requests recorded.</p>
            ) : (
              <div className="divide-y divide-white/5 max-h-[250px] overflow-y-auto pr-1">
                {failedLogins.map((x) => (
                  <div key={x.id} className="py-2.5 flex justify-between text-xs items-center">
                    <div>
                      <p className="font-bold text-slate-300">
                        {x.user?.profile?.displayName ? `@${x.user.profile.username}` : "Unregistered login"}
                      </p>
                      <p className="text-[10px] text-slate-505">IP Address: {x.ip} · Broker: {x.userAgent}</p>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {new Date(x.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Sessions */}
          <div className="glass border border-white/5 p-5 rounded-2xl bg-white/[0.01] space-y-4">
            <h3 className="text-sm font-bold text-slate-355 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-violet-405" /> Active Client Connections
            </h3>

            <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto pr-1">
              {sessions.map((s) => (
                <div key={s.id} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-slate-205">@{s.user?.profile?.username || "unknown"}</p>
                    <p className="text-[10px] text-slate-500">
                      Broker: {s.userAgent} · Active: {new Date(s.lastActiveAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleTerminate(s.id)}
                    className="px-2.5 py-1 rounded bg-[#0d0d14] border border-white/5 text-slate-450 hover:text-slate-200 hover:border-red-500/20 text-[10px] font-bold"
                  >
                    Kill Link
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* IP Blocklist */}
        <div className="space-y-6">
          {/* Add block */}
          <form onSubmit={handleAddIP} className="glass border border-white/5 p-5 rounded-2xl bg-white/[0.01] space-y-4">
            <h3 className="text-sm font-bold text-slate-350 flex items-center gap-1.5">
              <Ban className="w-4 h-4 text-rose-400" /> Ban IP Access Range
            </h3>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">IP Host/Subnet</label>
              <input
                type="text"
                placeholder="e.g. 192.168.1.1"
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#0d0d14] border border-white/5 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-violet-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Reason</label>
              <input
                type="text"
                placeholder="e.g. DDOS pattern matches"
                value={ipReason}
                onChange={(e) => setIpReason(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#0d0d14] border border-white/5 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-violet-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white transition-colors flex items-center justify-center gap-1"
              disabled={isPending}
            >
              <Plus className="w-3.5 h-3.5" /> Block Connection Link
            </button>
          </form>

          {/* List blocks */}
          <div className="glass border border-white/5 p-5 rounded-2xl bg-white/[0.01] space-y-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Fenced Address Indexes</span>
            {blockedIPs.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No active connection blockades set.</p>
            ) : (
              <div className="divide-y divide-white/5 space-y-2">
                {blockedIPs.map((b) => (
                  <div key={b.id} className="pt-2 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-slate-205">{b.ip}</p>
                      <p className="text-[9px] text-slate-500">{b.reason || "No detail set"}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveIP(b.id)}
                      className="p-1 rounded bg-[#0d0d14] hover:bg-rose-950/15 border border-white/5 hover:border-rose-900/30 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
