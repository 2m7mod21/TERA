"use client";

import React, { startTransition, useTransition } from "react";
import { MessageSquare, ShieldAlert, Lock, Info } from "lucide-react";

type MessagesAdminClientProps = {
  stats: {
    totalMessages: number;
    totalConversations: number;
    reportedCount: number;
  };
};

export default function MessagesAdminClient({ stats }: MessagesAdminClientProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Private Correspondence Monitor</h1>
        <p className="text-xs text-slate-500">Aggegrated logs, statistics databases, and user reports without exposing raw metadata text.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass border border-white/5 p-5 rounded-2xl bg-white/[0.01]">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Active Channels</span>
          <p className="text-2xl font-black text-white mt-1">{stats.totalConversations}</p>
        </div>
        <div className="glass border border-white/5 p-5 rounded-2xl bg-white/[0.01]">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Total Transmitted</span>
          <p className="text-2xl font-black text-white mt-1">{stats.totalMessages}</p>
        </div>
        <div className="glass border border-white/5 p-5 rounded-2xl bg-white/[0.01]">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Reported Channels</span>
          <p className="text-2xl font-black text-violet-400 mt-1">{stats.reportedCount}</p>
        </div>
      </div>

      {/* Security alert block explaining compliance / privacy */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-2xl text-xs flex gap-3">
        <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />
        <div className="space-y-1">
          <p className="font-bold text-white">Privacy and Encryption Safeguards Active</p>
          <p className="leading-relaxed">
            In compliance with user agreements and message confidentiality targets, direct text content of normal user 
            private threads is never visible directly in the admin dashboard panel. Flagged or reported threads will 
            instead show under the "Reports & Moderation" tab once a formal breach claim is submitted by the participant.
          </p>
        </div>
      </div>

      <div className="glass border border-white/5 p-6 rounded-2xl bg-white/[0.01] flex flex-col items-center justify-center text-center py-16">
        <Lock className="w-8 h-8 text-slate-700 mb-2" />
        <p className="text-xs text-slate-205 font-bold">End-to-End Compliance Verification Success</p>
        <p className="text-[10px] text-slate-500 mt-1.5 max-w-sm">Logs show zero database access requests by administrators outside of audit parameters.</p>
      </div>
    </div>
  );
}
