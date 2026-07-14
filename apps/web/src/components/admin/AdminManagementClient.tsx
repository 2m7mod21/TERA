"use client";

import React, { useState, useTransition } from "react";
import { UserCog, Plus, Trash2 } from "lucide-react";
import { changeAdminRole, inviteAdmin, removeAdmin } from "@/server/actions/admin/security";

export default function AdminManagementClient({
  admins,
  roles,
  currentRole,
}: {
  admins: any[];
  roles: any[];
  currentRole: string;
}) {
  const [inviteUserId, setInviteUserId] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState(roles[0]?.id || "");
  const [isPending, startTransition] = useTransition();

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUserId || !inviteRoleId) return;
    startTransition(async () => {
      const res = await inviteAdmin(inviteUserId, inviteRoleId);
      if (res.success) {
        alert("New Admin added successfully.");
        window.location.reload();
      } else {
        alert("Failed to assign admin node.");
      }
    });
  };

  const handleRoleChange = (adminUserId: string, newRoleId: string) => {
    startTransition(async () => {
      const res = await changeAdminRole(adminUserId, newRoleId);
      if (res.success) {
        alert("Admin role updated.");
        window.location.reload();
      }
    });
  };

  const handleRemove = (adminUserId: string) => {
    if (!confirm("Are you sure you want to strip admin permissions from this member?")) return;
    startTransition(async () => {
      const res = await removeAdmin(adminUserId);
      if (res.success) {
        alert("Admin removed.");
        window.location.reload();
      } else {
        alert(res.error || "Action failed");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Admin Team & RBAC Management</h1>
        <p className="text-xs text-slate-500">Configure team roles, alter permissions matrix, and coordinate clearance levels.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Admin List */}
        <div className="lg:col-span-2 glass border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
          <div className="p-4 border-b border-white/5 bg-white/[0.02]">
            <h3 className="text-sm font-bold text-slate-300">Registered Administrators</h3>
          </div>

          <div className="divide-y divide-white/5">
            {admins.map((adm) => (
              <div key={adm.id} className="p-4 flex items-center justify-between hover:bg-white/[0.005] transition-colors text-xs">
                <div>
                  <p className="font-bold text-slate-205">@{adm.user?.profile?.username || "unknown"}</p>
                  <p className="text-[10px] text-slate-500">Clearance role: {adm.role.name} · Assigned {new Date(adm.createdAt).toLocaleDateString()}</p>
                </div>

                <div className="flex gap-2 items-center">
                  {/* Selector to change role */}
                  <select
                    value={adm.roleId}
                    onChange={(e) => handleRoleChange(adm.id, e.target.value)}
                    className="bg-[#0d0d14] border border-white/5 text-[11px] px-2 py-1 rounded text-slate-300"
                    disabled={isPending || currentRole !== "OWNER"}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name.replace("_", " ")}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleRemove(adm.id)}
                    className="p-1.5 rounded bg-rose-950/10 hover:bg-rose-955/20 border border-rose-900/30 text-rose-400"
                    disabled={isPending || adm.userId === adm.invitedBy} // protect self remove helper
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invite Admin Form */}
        <form onSubmit={handleInvite} className="glass border border-white/5 p-5 rounded-2xl bg-white/[0.01] space-y-4">
          <h3 className="text-sm font-bold text-slate-350 flex items-center gap-1.5">
            <UserCog className="w-4 h-4 text-violet-405" /> Add Team Colleague
          </h3>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">User Identification ID</label>
            <input
              type="text"
              placeholder="Paste raw User UUID..."
              value={inviteUserId}
              onChange={(e) => setInviteUserId(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#0d0d14] border border-white/5 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-violet-500"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Target Level Access Role</label>
            <select
              value={inviteRoleId}
              onChange={(e) => setInviteRoleId(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#0d0d14] border border-white/5 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-violet-500"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="w-full py-1.5 rounded-lg bg-violet-600 hover:bg-violet-750 text-xs font-bold text-white transition-colors flex items-center justify-center gap-1"
            disabled={isPending}
          >
            <Plus className="w-3.5 h-3.5" /> Add Staff Member
          </button>
        </form>
      </div>
    </div>
  );
}
