"use client";

import React, { useState, useTransition } from "react";
import { Search, ShieldAlert, Award, UserMinus, Trash2, Ban } from "lucide-react";
import { getUsers, banUser, unbanUser, suspendUser, unsuspendUser, verifyUser, revokeVerification, deleteUser } from "@/server/actions/admin/users";

export default function UsersClient({
  initialUsers,
  initialCursor,
}: {
  initialUsers: any[];
  initialCursor: string | null;
}) {
  const [users, setUsers] = useState<any[]>(initialUsers);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "suspended" | "banned" | "verified">("all");
  const [isPending, startTransition] = useTransition();

  const handleFetch = (searchVal = search, statusVal = status, reset = false) => {
    startTransition(async () => {
      const res = await getUsers({
        search: searchVal || undefined,
        status: statusVal === "all" ? undefined : statusVal,
        cursor: reset ? undefined : (cursor || undefined),
      });
      if (reset) {
        setUsers(res.users);
      } else {
        setUsers((prev) => [...prev, ...res.users]);
      }
      setCursor(res.nextCursor);
    });
  };

  const handleAction = (userId: string, actionFn: (id: string, ...args: any[]) => Promise<any>, actionArg?: string) => {
    if (!confirm("Are you sure you want to perform this operation?")) return;
    startTransition(async () => {
      const res = await actionFn(userId, actionArg || "");
      if (res.success) {
        // Refresh local items
        handleFetch(search, status, true);
      } else {
        alert(res.error || "Action failed");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">User Management</h1>
        <p className="text-xs text-slate-500">View, moderate, and adjust authentication flags for all registered members.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search email, username..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              handleFetch(e.target.value, status, true);
            }}
            className="w-full pl-9 pr-4 py-1.5 bg-[#0d0d14] border border-white/5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 w-full sm:w-auto">
          {(["all", "active", "suspended", "banned", "verified"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => {
                setStatus(opt);
                handleFetch(search, opt, true);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider border transition-all ${
                status === opt
                  ? "bg-violet-500/15 border-violet-500/30 text-violet-300"
                  : "bg-[#0d0d14] border-white/5 text-slate-500 hover:text-slate-200"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/[0.02]">
                <th className="py-3 px-5">Member</th>
                <th className="py-3 px-5">Status Flags</th>
                <th className="py-3 px-5">Registration</th>
                <th className="py-3 px-5 text-right">Moderator Enforcement Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="py-3.5 px-5">
                    <div>
                      <p className="font-bold text-slate-200">{u.profile?.displayName ?? "Member"}</p>
                      <p className="text-[10px] text-slate-500">@{u.profile?.username ?? "username"}</p>
                      <p className="text-[10px] text-slate-600">{u.email || u.phone}</p>
                    </div>
                  </td>
                  <td className="py-3.5 px-5 space-x-1.5">
                    {u.isBanned && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400">
                        Banned
                      </span>
                    )}
                    {u.isSuspended && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                        Suspended
                      </span>
                    )}
                    {u.verifiedBadge && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        Verified
                      </span>
                    )}
                    {!u.isBanned && !u.isSuspended && !u.verifiedBadge && (
                      <span className="text-[10px] text-slate-500">Standard</span>
                    )}
                  </td>
                  <td className="py-3.5 px-5 text-slate-400">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-5 text-right space-x-1">
                    {u.isBanned ? (
                      <button
                        onClick={() => handleAction(u.id, unbanUser)}
                        className="px-2.5 py-1 rounded bg-slate-900 border border-white/5 hover:bg-slate-800 text-slate-300 font-semibold"
                      >
                        Unban
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          const r = prompt("Reason for banning this user:");
                          if (r) handleAction(u.id, banUser, r);
                        }}
                        className="px-2.5 py-1 rounded bg-rose-950/20 border border-rose-900/30 text-rose-350 hover:bg-rose-900/30 font-semibold"
                      >
                        Ban
                      </button>
                    )}

                    {u.isSuspended ? (
                      <button
                        onClick={() => handleAction(u.id, unsuspendUser)}
                        className="px-2.5 py-1 rounded bg-slate-900 border border-white/5 hover:bg-slate-800 text-slate-300 font-semibold"
                      >
                        Unsuspend
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAction(u.id, suspendUser)}
                        className="px-2.5 py-1 rounded bg-amber-950/20 border border-amber-900/30 text-amber-350 hover:bg-amber-900/30 font-semibold"
                      >
                        Suspend
                      </button>
                    )}

                    {u.verifiedBadge ? (
                      <button
                        onClick={() => handleAction(u.id, revokeVerification)}
                        className="px-2.5 py-1 rounded bg-slate-900 border border-white/5 hover:bg-slate-800 text-slate-400 font-semibold"
                      >
                        Revoke Badge
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAction(u.id, verifyUser)}
                        className="px-2.5 py-1 rounded bg-emerald-950/20 border border-emerald-900/30 text-emerald-350 hover:bg-emerald-900/30 font-semibold"
                      >
                        Verify
                      </button>
                    )}

                    <button
                      onClick={() => handleAction(u.id, deleteUser)}
                      className="px-2.5 py-1 rounded bg-slate-900 border border-red-500/20 text-red-400 hover:bg-red-500/10 font-semibold"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {cursor && (
          <div className="p-4 border-t border-white/5 flex justify-center bg-white/[0.01]">
            <button
              onClick={() => handleFetch(search, status, false)}
              className="px-4 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300"
              disabled={isPending}
            >
              {isPending ? "Loading..." : "Load More Users"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
