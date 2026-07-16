"use client";

import React, { useTransition } from "react";
import { BadgeCheck, UserMinus, Award } from "lucide-react";
import { revokeVerification } from "@/server/actions/admin/users";

export default function VerificationClient({ verifiedUsers }: { verifiedUsers: any[] }) {
  const [isPending, startTransitionHook] = useTransition();

  const handleAction = (userId: string, actionFn: (id: string) => Promise<any>) => {
    if (!confirm("Are you sure?")) return;
    startTransitionHook(async () => {
      await actionFn(userId);
      window.location.reload();
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Identity Verification Center</h1>
        <p className="text-xs text-slate-500">Review status and badge eligibility of VIPs, creators, and public figures.</p>
      </div>

      <div className="glass border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
        <div className="p-4 border-b border-white/5 bg-white/[0.02]">
          <h3 className="text-sm font-bold text-slate-300">Verified Badges Enforced</h3>
        </div>
        
        {verifiedUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Award className="w-8 h-8 text-slate-700 mb-2" />
            <p className="text-xs text-slate-500">No users currently have the Verified badge badge active on this node.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {verifiedUsers.map((u) => (
              <div key={u.id} className="p-4 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center font-bold text-slate-300 uppercase">
                    {(u.profile?.displayName ?? "U")[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-200">{u.profile?.displayName}</p>
                      <BadgeCheck className="w-3.5 h-3.5 text-blue-400 fill-blue-400/10" />
                    </div>
                    <p className="text-[10px] text-slate-500">@{u.profile?.username} · Joined {new Date(u.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleAction(u.id, revokeVerification)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/15 border border-rose-900/20 hover:bg-rose-900/30 text-rose-450 text-[11px] font-semibold transition-colors"
                  disabled={isPending}
                >
                  <UserMinus className="w-3 h-3" />
                  Revoke Verification Badge
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
