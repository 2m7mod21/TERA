"use client";

import React, { useState, useTransition } from "react";
import { Settings, Save, ShieldAlert, Cpu } from "lucide-react";
import { updateSetting } from "@/server/actions/admin/settings";

export default function SettingsClient({ settings }: { settings: Record<string, any> }) {
  const [vals, setVals] = useState(settings);
  const [isPending, startTransition] = useTransition();

  const handleSave = (key: string) => {
    startTransition(async () => {
      const res = await updateSetting(key, vals[key]);
      if (res.success) {
        alert(`Setting '${key}' saved successfully.`);
      } else {
        alert("Failed to save setting");
      }
    });
  };

  const updateVal = (key: string, value: any) => {
    setVals((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Platform Settings</h1>
        <p className="text-xs text-slate-500">Fine-tune global properties, registration paths, and size thresholds.</p>
      </div>

      <div className="space-y-4">
        {/* Site Details Card */}
        <div className="glass border border-white/5 p-6 rounded-2xl bg-white/[0.01] space-y-4">
          <h3 className="text-sm font-bold text-slate-350 flex items-center gap-2">
            <Settings className="w-4 h-4 text-violet-400" /> Branding & Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Name Site</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={vals["site.name"] ?? ""}
                  onChange={(e) => updateVal("site.name", e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-[#0d0d14] border border-white/5 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-violet-500"
                />
                <button
                  onClick={() => handleSave("site.name")}
                  className="px-3 py-1.5 rounded-lg bg-violet-605 border border-violet-500/20 hover:bg-violet-600 text-xs font-semibold text-white transition-colors"
                  disabled={isPending}
                >
                  Save
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Accent Hex</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={vals["site.accentColor"] ?? ""}
                  onChange={(e) => updateVal("site.accentColor", e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-[#0d0d14] border border-white/5 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-violet-500"
                />
                <button
                  onClick={() => handleSave("site.accentColor")}
                  className="px-3 py-1.5 rounded-lg bg-violet-605 border border-violet-500/20 hover:bg-violet-600 text-xs font-semibold text-white transition-colors"
                  disabled={isPending}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Boundaries */}
        <div className="glass border border-white/5 p-6 rounded-2xl bg-white/[0.01] space-y-4">
          <h3 className="text-sm font-bold text-slate-350 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-violet-400" /> Size & Volume Restrictions
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Max Post Content Text Length</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={vals["content.maxPostLength"] ?? 2000}
                  onChange={(e) => updateVal("content.maxPostLength", Number(e.target.value))}
                  className="flex-1 px-3 py-1.5 bg-[#0d0d14] border border-white/5 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-violet-500"
                />
                <button
                  onClick={() => handleSave("content.maxPostLength")}
                  className="px-3 py-1.5 rounded-lg bg-violet-605 border border-violet-500/20 hover:bg-violet-600 text-xs font-semibold text-white transition-colors"
                  disabled={isPending}
                >
                  Save
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Max Media File Megabytes (MB)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={vals["content.maxImageSizeMb"] ?? 10}
                  onChange={(e) => updateVal("content.maxImageSizeMb", Number(e.target.value))}
                  className="flex-1 px-3 py-1.5 bg-[#0d0d14] border border-white/5 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-violet-500"
                />
                <button
                  onClick={() => handleSave("content.maxImageSizeMb")}
                  className="px-3 py-1.5 rounded-lg bg-violet-605 border border-violet-500/20 hover:bg-violet-600 text-xs font-semibold text-white transition-colors"
                  disabled={isPending}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Global toggles */}
        <div className="glass border border-white/5 p-6 rounded-2xl bg-white/[0.01] space-y-4">
          <h3 className="text-sm font-bold text-slate-350 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-violet-400" /> Platform Access Control Switches
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold">
            <div className="flex justify-between items-center p-3 bg-white/[0.02] border border-white/5 rounded-xl">
              <span className="text-slate-400">Email Signup</span>
              <input
                type="checkbox"
                checked={vals["register.emailEnabled"] ?? true}
                onChange={(e) => {
                  updateVal("register.emailEnabled", e.target.checked);
                  // Auto save on toggle
                  startTransition(async () => {
                    await updateSetting("register.emailEnabled", e.target.checked);
                  });
                }}
                className="accent-violet-500 w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="flex justify-between items-center p-3 bg-white/[0.02] border border-white/5 rounded-xl">
              <span className="text-slate-400">New Registrations</span>
              <input
                type="checkbox"
                checked={vals["register.newSignupsEnabled"] ?? true}
                onChange={(e) => {
                  updateVal("register.newSignupsEnabled", e.target.checked);
                  startTransition(async () => {
                    await updateSetting("register.newSignupsEnabled", e.target.checked);
                  });
                }}
                className="accent-violet-500 w-4 h-4 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
