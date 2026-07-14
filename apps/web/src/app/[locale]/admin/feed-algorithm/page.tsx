"use client";

import React, { useEffect, useState, useTransition } from "react";
import {
  getFeedWeightProfile,
  listWeightProfiles,
  saveFeedWeightProfile,
  resetFeedWeightProfile,
  createWeightProfile,
  getFeedWeightAuditLog,
} from "@/server/actions/admin/feed-weights";

const WEIGHT_META: Record<string, { label: string; description: string; min: number; max: number; step: number }> = {
  affinity:                 { label: "Affinity",                   description: "Viewer→author personal connection weight",          min: 0, max: 1,   step: 0.01  },
  engagement:               { label: "Engagement",                 description: "Predicted post engagement probability weight",      min: 0, max: 1,   step: 0.01  },
  contentMatch:             { label: "Content Match",              description: "Topic/interest vector overlap weight",              min: 0, max: 1,   step: 0.01  },
  recency:                  { label: "Recency",                    description: "Freshness / time-decay weight",                    min: 0, max: 1,   step: 0.01  },
  coldStart:                { label: "Cold-Start Boost",           description: "Boost for new / low-follower creators",            min: 0, max: 1,   step: 0.01  },
  halfLifeHours:            { label: "Half-Life (hours)",          description: "Recency decay half-life — lower = fresher bias",   min: 1, max: 720, step: 1     },
  maxPerAuthor:             { label: "Max Per Author",             description: "Max posts per author per page (diversity cap)",    min: 1, max: 10,  step: 1     },
  explorationSlotPct:       { label: "Exploration Slot %",        description: "% of feed positions filled from content-match pool", min: 0, max: 0.5, step: 0.01 },
  trendingGuaranteedEvery:  { label: "Trending Slot (every N)",   description: "Force a trending post every N positions (0=off)",   min: 0, max: 50,  step: 1     },
  coldStartGuaranteedEvery: { label: "Cold-Start Slot (every N)", description: "Force a cold-start post every N positions (0=off)", min: 0, max: 50,  step: 1     },
};

export default function FeedAlgorithmPage() {
  const [profiles, setProfiles] = useState<string[]>(["default"]);
  const [activeProfile, setActiveProfile] = useState("default");
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [newProfileName, setNewProfileName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadProfile(profileName: string) {
    const { configs } = await getFeedWeightProfile(profileName);
    const w: Record<string, number> = {};
    for (const c of configs) w[c.componentKey] = c.value;
    setWeights(w);
  }

  async function loadAudit(profileName: string) {
    const logs = await getFeedWeightAuditLog(profileName, 20);
    setAuditLog(logs);
  }

  useEffect(() => {
    listWeightProfiles().then((p) => { if (p.length > 0) setProfiles(p); });
    loadProfile("default");
    loadAudit("default");
  }, []);

  function handleProfileChange(name: string) {
    setActiveProfile(name);
    loadProfile(name);
    loadAudit(name);
  }

  function handleWeightChange(key: string, val: number) {
    setWeights((prev) => ({ ...prev, [key]: val }));
  }

  function handleSave() {
    setStatus(null);
    startTransition(async () => {
      const result = await saveFeedWeightProfile(activeProfile, weights);
      setStatus(result.success ? "✅ Saved & applied" : "❌ Save failed");
      await loadAudit(activeProfile);
    });
  }

  function handleReset() {
    setStatus(null);
    startTransition(async () => {
      const result = await resetFeedWeightProfile(activeProfile);
      setStatus(result.success ? "✅ Reset to defaults" : "❌ Reset failed");
      await loadProfile(activeProfile);
      await loadAudit(activeProfile);
    });
  }

  function handleCreateProfile() {
    if (!newProfileName.trim()) return;
    startTransition(async () => {
      const result = await createWeightProfile(newProfileName.trim());
      if (result.success) {
        const updated = await listWeightProfiles();
        setProfiles(updated);
        handleProfileChange(newProfileName.trim());
        setNewProfileName("");
      } else {
        setStatus(`❌ ${result.error}`);
      }
    });
  }

  return (
    <div className="min-h-screen bg-[#0f0f14] text-white font-sans">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#16161e] px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Feed Algorithm Weights
          </h1>
          <p className="text-white/50 text-sm mt-0.5">Tune ranking components – changes apply to the next feed request</p>
        </div>
        {status && (
          <span className="text-sm px-4 py-2 rounded-full bg-white/10 border border-white/20">{status}</span>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8 grid grid-cols-3 gap-8">

        {/* Left: Profile selector + Weight sliders */}
        <div className="col-span-2 space-y-6">

          {/* Profile selector */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-4 flex-wrap">
              <label className="text-sm text-white/60">Profile:</label>
              <select
                value={activeProfile}
                onChange={(e) => handleProfileChange(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {profiles.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <div className="flex items-center gap-2 ml-auto">
                <input
                  type="text"
                  placeholder="New profile name…"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500 w-44"
                />
                <button
                  onClick={handleCreateProfile}
                  disabled={isPending || !newProfileName.trim()}
                  className="text-sm px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 transition"
                >
                  Create
                </button>
              </div>
            </div>
          </div>

          {/* Score component weights */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-6">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Score Component Weights</h2>
            {["affinity", "engagement", "contentMatch", "recency", "coldStart"].map((key) => {
              const meta = WEIGHT_META[key]!;
              const val = weights[key] ?? 0;
              return (
                <div key={key}>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <div>
                      <span className="text-sm font-medium">{meta.label}</span>
                      <span className="text-xs text-white/40 ml-2">{meta.description}</span>
                    </div>
                    <span className="text-sm font-mono text-violet-300">{val.toFixed(2)}</span>
                  </div>
                  <div className="relative">
                    <input
                      type="range"
                      min={meta.min}
                      max={meta.max}
                      step={meta.step}
                      value={val}
                      onChange={(e) => handleWeightChange(key, parseFloat(e.target.value))}
                      className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/10 accent-violet-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Diversity & tuning config */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-5">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Diversity & Tuning</h2>
            {["halfLifeHours", "maxPerAuthor", "explorationSlotPct", "trendingGuaranteedEvery", "coldStartGuaranteedEvery"].map((key) => {
              const meta = WEIGHT_META[key]!;
              const val = weights[key] ?? 0;
              return (
                <div key={key} className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{meta.label}</div>
                    <div className="text-xs text-white/40">{meta.description}</div>
                  </div>
                  <input
                    type="number"
                    min={meta.min}
                    max={meta.max}
                    step={meta.step}
                    value={val}
                    onChange={(e) => handleWeightChange(key, parseFloat(e.target.value))}
                    className="w-24 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white font-mono text-right focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-40 font-semibold text-sm transition"
            >
              {isPending ? "Saving…" : "Save & Apply"}
            </button>
            <button
              onClick={handleReset}
              disabled={isPending}
              className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-40 text-sm font-medium transition border border-white/10"
            >
              Reset to Default
            </button>
          </div>
        </div>

        {/* Right: Audit Log */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 h-fit">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Audit Log</h2>
          {auditLog.length === 0 ? (
            <p className="text-xs text-white/30 text-center py-6">No changes recorded yet.</p>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[600px] pr-1">
              {auditLog.map((log: any) => (
                <div key={log.id} className="text-xs border-b border-white/5 pb-3 last:border-0">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-mono text-violet-300">{log.componentKey}</span>
                    <span className="text-white/30 flex-shrink-0">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-0.5 text-white/50">
                    <span className="line-through text-red-400/70">{log.oldValue?.toFixed?.(2) ?? log.oldValue}</span>
                    <span>→</span>
                    <span className="text-green-400/80">{log.newValue?.toFixed?.(2) ?? log.newValue}</span>
                  </div>
                  <div className="text-white/30 mt-0.5">
                    by {log.admin?.profile?.displayName ?? "unknown"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
