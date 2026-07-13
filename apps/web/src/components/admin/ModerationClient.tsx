"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Shield, Plus, Trash2, Search, ShieldAlert,
  X, AlertTriangle, Settings, RefreshCw,
  Eye, AlertCircle
} from "lucide-react";
import {
  getBlockedWords,
  addBlockedWord,
  updateBlockedWord,
  deleteBlockedWord,
  getViolations,
  getViolationStats,
  getModerationSettings,
  updateModerationSettings,
} from "@/server/actions/admin/moderation";

export default function ModerationClient() {
  const [activeTab, setActiveTab] = useState<"words" | "violations" | "settings">("words");
  const [isPending, startTransition] = useTransition();

  // Settings states
  const [modAction, setModAction] = useState<string>("BLOCK");
  const [settingsStatus, setSettingsStatus] = useState<string | null>(null);

  // Blocked Words States
  const [words, setWords] = useState<any[]>([]);
  const [wordsSearch, setWordsSearch] = useState("");
  const [wordsCategory, setWordsCategory] = useState("");
  const [wordsSeverity, setWordsSeverity] = useState("");
  const [wordsLanguage, setWordsLanguage] = useState("");
  const [wordsPage, setWordsPage] = useState(1);
  const [wordsTotalPages, setWordsTotalPages] = useState(1);

  // New Word Dialog States
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWord, setNewWord] = useState("");
  const [newLang, setNewLang] = useState("en");
  const [newCategory, setNewCategory] = useState("PROFANITY");
  const [newSeverity, setNewSeverity] = useState("LOW");
  const [addError, setAddError] = useState<string | null>(null);

  // Violations States
  const [violations, setViolations] = useState<any[]>([]);
  const [violSearch, setViolSearch] = useState("");
  const [violType, setViolType] = useState("");
  const [violSeverity, setViolSeverity] = useState("");
  const [violPage, setViolPage] = useState(1);
  const [violTotalPages, setViolTotalPages] = useState(1);

  // Violation Stats State
  const [stats, setStats] = useState<any>(null);

  // Load Settings
  const fetchSettings = async () => {
    const res = await getModerationSettings();
    if (res.success && res.settings) {
      setModAction(res.settings.moderation_action);
    }
  };

  const handleSaveSettings = () => {
    setSettingsStatus("Saving...");
    startTransition(async () => {
      const res = await updateModerationSettings({ moderation_action: modAction });
      if (res.success) {
        setSettingsStatus("Settings saved successfully!");
      } else {
        setSettingsStatus(res.error || "Failed to save settings");
      }
      setTimeout(() => setSettingsStatus(null), 3000);
    });
  };

  // Load Blocked Words
  const fetchWords = (page = wordsPage) => {
    startTransition(async () => {
      const res = await getBlockedWords({
        search: wordsSearch || undefined,
        category: wordsCategory || undefined,
        severity: wordsSeverity || undefined,
        language: wordsLanguage || undefined,
        page,
        limit: 10,
      });
      if (res.success && res.words) {
        setWords(res.words);
        setWordsPage(page);
        if (res.pagination) {
          setWordsTotalPages(res.pagination.totalPages);
        }
      }
    });
  };

  // Load Violations & Stats
  const fetchViolations = (page = violPage) => {
    startTransition(async () => {
      const res = await getViolations({
        search: violSearch || undefined,
        violationType: violType || undefined,
        severity: violSeverity || undefined,
        page,
        limit: 10,
      });
      if (res.success && res.violations) {
        setViolations(res.violations);
        setViolPage(page);
        if (res.pagination) {
          setViolTotalPages(res.pagination.totalPages);
        }
      }
    });
  };

  const fetchStats = async () => {
    const res = await getViolationStats();
    if (res.success && res.stats) {
      setStats(res.stats);
    }
  };

  useEffect(() => {
    if (activeTab === "words") {
      fetchWords(1);
    } else if (activeTab === "violations") {
      fetchViolations(1);
      fetchStats();
    } else if (activeTab === "settings") {
      fetchSettings();
    }
  }, [activeTab]);

  // Actions
  const handleAddNewWord = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (!newWord.trim()) return;

    const res = await addBlockedWord({
      word: newWord,
      language: newLang,
      category: newCategory,
      severity: newSeverity,
    });

    if (res.success) {
      setNewWord("");
      setShowAddModal(false);
      fetchWords(1);
    } else {
      setAddError(res.error || "Failed to add word");
    }
  };

  const handleToggleWord = async (id: string, active: boolean) => {
    const res = await updateBlockedWord(id, { isActive: active });
    if (res.success) {
      setWords((prev) =>
        prev.map((w) => (w.id === id ? { ...w, isActive: active } : w))
      );
    }
  };

  const handleDeleteWord = async (id: string) => {
    if (!confirm("Are you sure you want to delete this word from the blocklist?")) return;
    const res = await deleteBlockedWord(id);
    if (res.success) {
      fetchWords(wordsPage);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white font-mono uppercase">
            Content Moderation Manager
          </h1>
          <p className="text-xs text-slate-500">
            Control automated profanity lists, view violations, and adjust Platform policy enforcement.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab("words")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "words"
                ? "bg-violet-600 text-white shadow"
                : "text-slate-400 hover:text-slate-205"
            }`}
          >
            <Shield className="w-3.5 h-3.5 inline mr-1" />
            Blocked Words
          </button>
          <button
            onClick={() => setActiveTab("violations")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "violations"
                ? "bg-violet-600 text-white shadow"
                : "text-slate-400 hover:text-slate-205"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 inline mr-1" />
            User Violations
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "settings"
                ? "bg-violet-600 text-white shadow"
                : "text-slate-400 hover:text-slate-205"
            }`}
          >
            <Settings className="w-3.5 h-3.5 inline mr-1" />
            Settings
          </button>
        </div>
      </div>

      {/* Main Tab UI */}
      {activeTab === "words" && (
        <div className="space-y-4">
          {/* Filters Area */}
          <div className="flex flex-wrap gap-3 items-center justify-between bg-white/[0.01] border border-white/5 rounded-xl p-4">
            <div className="flex flex-wrap gap-2.5 flex-1 items-center">
              {/* Search */}
              <div className="relative w-full max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search blocked words..."
                  value={wordsSearch}
                  onChange={(e) => setWordsSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchWords(1)}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg pl-8 pr-3 py-1.5 focus:border-violet-500/50 outline-none text-xs"
                />
              </div>

              {/* Language filter */}
              <select
                value={wordsLanguage}
                onChange={(e) => setWordsLanguage(e.target.value)}
                className="bg-white/5 border border-white/10 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-violet-500/50"
              >
                <option value="" className="bg-[#12121e]">All Languages</option>
                <option value="en" className="bg-[#12121e]">English (en)</option>
                <option value="ar" className="bg-[#12121e]">Arabic (ar)</option>
              </select>

              {/* Category filter */}
              <select
                value={wordsCategory}
                onChange={(e) => setWordsCategory(e.target.value)}
                className="bg-white/5 border border-white/10 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-violet-500/50"
              >
                <option value="" className="bg-[#12121e]">All Categories</option>
                <option value="INSULT" className="bg-[#12121e]">Insult</option>
                <option value="PROFANITY" className="bg-[#12121e]">Profanity</option>
                <option value="SEXUAL" className="bg-[#12121e]">Explicit/Sexual</option>
                <option value="HATE" className="bg-[#12121e]">Hate Speech</option>
                <option value="HARASSMENT" className="bg-[#12121e]">Harassment</option>
                <option value="SPAM" className="bg-[#12121e]">Spam</option>
              </select>

              {/* Severity filter */}
              <select
                value={wordsSeverity}
                onChange={(e) => setWordsSeverity(e.target.value)}
                className="bg-white/5 border border-white/10 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-violet-500/50"
              >
                <option value="" className="bg-[#12121e]">All Severities</option>
                <option value="LOW" className="bg-[#12121e]">Low</option>
                <option value="MEDIUM" className="bg-[#12121e]">Medium</option>
                <option value="HIGH" className="bg-[#12121e]">High</option>
                <option value="CRITICAL" className="bg-[#12121e]">Critical</option>
              </select>

              <button
                onClick={() => fetchWords(1)}
                className="px-3.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-slate-200 transition"
              >
                Apply Details
              </button>
            </div>

            {/* Add button */}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-4.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Blocked Word
            </button>
          </div>

          {/* Table Container */}
          <div className="glass border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-slate-400 font-semibold tracking-wider font-mono">
                  <th className="p-4">Blocked Term</th>
                  <th className="p-4">Lang</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Severity</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isPending && words.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-violet-500" />
                      Fetching blocked word registry...
                    </td>
                  </tr>
                ) : words.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      <AlertCircle className="w-5 h-5 mx-auto mb-2 text-slate-500" />
                      No blocked words match selection criteria.
                    </td>
                  </tr>
                ) : (
                  words.map((w) => (
                    <tr key={w.id} className="hover:bg-white/[0.005] group">
                      <td className="p-4 font-mono font-bold text-slate-200 text-sm">
                        {w.word}
                      </td>
                      <td className="p-4">
                        <span className="uppercase text-[9px] font-bold text-slate-450 border border-slate-500/20 px-1.5 py-0.5 rounded">
                          {w.language}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-slate-350">{w.category}</span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`font-semibold text-[10px] px-2 py-0.5 rounded ${
                            w.severity === "CRITICAL"
                              ? "bg-red-500/10 text-red-400 border border-red-500/20"
                              : w.severity === "HIGH"
                              ? "bg-orange-500/10 text-orange-450 border border-orange-500/20"
                              : w.severity === "MEDIUM"
                              ? "bg-amber-500/10 text-amber-450 border border-amber-500/20"
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}
                        >
                          {w.severity}
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => handleToggleWord(w.id, !w.isActive)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            w.isActive ? "bg-emerald-500" : "bg-slate-700"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              w.isActive ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeleteWord(w.id)}
                          className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-white/5 opacity-0 group-hover:opacity-100 transition"
                          title="Delete blocked word"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {wordsTotalPages > 1 && (
              <div className="flex justify-between items-center p-4 border-t border-white/5 bg-white/[0.005]">
                <p className="text-slate-500">
                  Page {wordsPage} of {wordsTotalPages}
                </p>
                <div className="flex gap-1.5">
                  <button
                    disabled={wordsPage === 1 || isPending}
                    onClick={() => fetchWords(wordsPage - 1)}
                    className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10"
                  >
                    Previous
                  </button>
                  <button
                    disabled={wordsPage === wordsTotalPages || isPending}
                    onClick={() => fetchWords(wordsPage + 1)}
                    className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "violations" && (
        <div className="space-y-6">
          {/* Stats area */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4">
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Total Violations</p>
                <p className="text-2xl font-bold text-white mt-1">{stats.totalViolations}</p>
              </div>
              <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4">
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Active Strikes</p>
                <p className="text-2xl font-bold text-amber-500 mt-1">{stats.activeViolations}</p>
              </div>
              <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4">
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Most Logged Type</p>
                <p className="text-slate-200 mt-1 text-sm font-semibold truncate">
                  {stats.typeCounts?.[0]?.type || "None"}
                </p>
              </div>
              <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4">
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Critical Actions</p>
                <p className="text-2xl font-bold text-red-500 mt-1">
                  {stats.severityCounts?.find((s: any) => s.severity === "CRITICAL")?.count || 0}
                </p>
              </div>
            </div>
          )}

          {/* Filter Area */}
          <div className="flex flex-wrap gap-2.5 items-center justify-between bg-white/[0.01] border border-white/5 rounded-xl p-4">
            <div className="flex flex-wrap gap-2.5 items-center flex-1">
              <div className="relative w-full max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search user email or @username..."
                  value={violSearch}
                  onChange={(e) => setViolSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchViolations(1)}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg pl-8 pr-3 py-1.5 focus:border-violet-500/50 outline-none text-xs"
                />
              </div>

              {/* Type filter */}
              <select
                value={violType}
                onChange={(e) => setViolType(e.target.value)}
                className="bg-white/5 border border-white/10 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-violet-500/50"
              >
                <option value="" className="bg-[#12121e]">All Violation Types</option>
                <option value="INSULT" className="bg-[#12121e]">Insult</option>
                <option value="PROFANITY" className="bg-[#12121e]">Profanity</option>
                <option value="SEXUAL" className="bg-[#12121e]">Explicit/Sexual</option>
                <option value="HATE" className="bg-[#12121e]">Hate Speech</option>
                <option value="HARASSMENT" className="bg-[#12121e]">Harassment</option>
                <option value="SPAM" className="bg-[#12121e]">Spam</option>
              </select>

              {/* Severity filter */}
              <select
                value={violSeverity}
                onChange={(e) => setViolSeverity(e.target.value)}
                className="bg-white/5 border border-white/10 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-violet-500/50"
              >
                <option value="" className="bg-[#12121e]">All Severities</option>
                <option value="LOW" className="bg-[#12121e]">Low</option>
                <option value="MEDIUM" className="bg-[#12121e]">Medium</option>
                <option value="HIGH" className="bg-[#12121e]">High</option>
                <option value="CRITICAL" className="bg-[#12121e]">Critical</option>
              </select>

              <button
                onClick={() => fetchViolations(1)}
                className="px-3.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-slate-200 transition"
              >
                Filter Logs
              </button>
            </div>
            <button
              onClick={() => { fetchViolations(violPage); fetchStats(); }}
              className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-slate-350 transition"
              title="Refresh logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Violations Log List */}
          <div className="glass border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-slate-400 font-semibold tracking-wider font-mono">
                  <th className="p-4">Offending User</th>
                  <th className="p-4">Violation Type</th>
                  <th className="p-4">Severity</th>
                  <th className="p-4">Strike No.</th>
                  <th className="p-4">Action Taken</th>
                  <th className="p-4">Details</th>
                  <th className="p-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isPending && violations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-violet-500" />
                      Loading platform audit logs...
                    </td>
                  </tr>
                ) : violations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      <Eye className="w-5 h-5 mx-auto mb-2 text-slate-500" />
                      No safety violation records found.
                    </td>
                  </tr>
                ) : (
                  violations.map((v) => (
                    <tr key={v.id} className="hover:bg-white/[0.005]">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center font-bold text-violet-400">
                            {v.user?.profile?.username?.[0]?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-200">
                              {v.user?.profile?.displayName || "Platform User"}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              @{v.user?.profile?.username || v.user?.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-semibold text-slate-350">{v.violationType}</span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`font-semibold text-[10px] px-1.5 py-0.5 rounded ${
                            v.severity === "CRITICAL"
                              ? "text-red-400"
                              : v.severity === "HIGH"
                              ? "text-orange-400"
                              : v.severity === "MEDIUM"
                              ? "text-amber-400"
                              : "text-blue-400"
                          }`}
                        >
                          {v.severity}
                        </span>
                      </td>
                      <td className="p-4 text-center font-mono font-bold">
                        <span className="text-slate-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                          Strike {v.strikeNumber}
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            v.actionTaken === "PERM_BAN"
                              ? "bg-red-950 text-red-400 border border-red-700/30"
                              : v.actionTaken === "TEMP_SUSPEND"
                              ? "bg-orange-950/80 text-orange-400 border border-orange-700/30"
                              : v.actionTaken === "FEATURE_RESTRICT"
                              ? "bg-amber-950/50 text-amber-450 border border-amber-600/20"
                              : "bg-blue-950/20 text-blue-400 border border-blue-600/20"
                          }`}
                        >
                          {v.actionTaken}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400 max-w-[200px] truncate">
                        {v.contentType ? (
                          <div className="space-y-0.5 text-[10px]">
                            <p>
                              Type: <span className="font-mono text-slate-205">{v.contentType}</span>
                            </p>
                            {v.matchedWords && (
                              <p className="text-red-400/80 truncate">
                                Matched: <span className="font-mono font-bold">{v.matchedWords}</span>
                              </p>
                            )}
                          </div>
                        ) : (
                          "Blocked upload attempt"
                        )}
                      </td>
                      <td className="p-4 text-slate-500 font-mono text-[10px] whitespace-nowrap">
                        {new Date(v.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {violTotalPages > 1 && (
              <div className="flex justify-between items-center p-4 border-t border-white/5 bg-white/[0.005]">
                <p className="text-slate-500">
                  Page {violPage} of {violTotalPages}
                </p>
                <div className="flex gap-1.5">
                  <button
                    disabled={violPage === 1 || isPending}
                    onClick={() => fetchViolations(violPage - 1)}
                    className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10"
                  >
                    Previous
                  </button>
                  <button
                    disabled={violPage === violTotalPages || isPending}
                    onClick={() => fetchViolations(violPage + 1)}
                    className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "settings" && (
        <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-6 max-w-xl">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-violet-600/10 flex items-center justify-center text-violet-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase font-mono">Enforcement Rules</h2>
              <p className="text-xs text-slate-505">Set how the content checking normalizer behaves on policy breach.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">
                Violation Action Strategy
              </label>
              <div className="grid grid-cols-1 gap-2.5">
                {/* Block option */}
                <label
                  onClick={() => setModAction("BLOCK")}
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    modAction === "BLOCK"
                      ? "bg-violet-600/15 border-violet-500/40 text-slate-200"
                      : "bg-white/[0.005] border-white/5 text-slate-400 hover:bg-white/[0.015]"
                  }`}
                >
                  <input
                    type="radio"
                    name="modRule"
                    checked={modAction === "BLOCK"}
                    onChange={() => {}}
                    className="sr-only"
                  />
                  <div className="w-4 h-4 rounded-full border border-slate-550 flex items-center justify-center mt-0.5 flex-shrink-0">
                    {modAction === "BLOCK" && <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200">BLOCK CONTENT (Hard Enforce)</h3>
                    <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                      Instantly reject post or comment publications. Returns validation error to the client. Issues 1 strike.
                    </p>
                  </div>
                </label>

                {/* Hide words option */}
                <label
                  onClick={() => setModAction("REPLACE")}
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    modAction === "REPLACE"
                      ? "bg-violet-600/15 border-violet-500/40 text-slate-200"
                      : "bg-white/[0.005] border-white/5 text-slate-400 hover:bg-white/[0.015]"
                  }`}
                >
                  <input
                    type="radio"
                    name="modRule"
                    checked={modAction === "REPLACE"}
                    onChange={() => {}}
                    className="sr-only"
                  />
                  <div className="w-4 h-4 rounded-full border border-slate-550 flex items-center justify-center mt-0.5 flex-shrink-0">
                    {modAction === "REPLACE" && <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200">CENSOR CONTENT (Replace Mode)</h3>
                    <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                      Allow submission but mask matched words with asterisks (e.g. ****). Logs strike.
                    </p>
                  </div>
                </label>

                {/* Warn option */}
                <label
                  onClick={() => setModAction("WARN")}
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    modAction === "WARN"
                      ? "bg-violet-600/15 border-violet-500/40 text-slate-200"
                      : "bg-white/[0.005] border-white/5 text-slate-400 hover:bg-white/[0.015]"
                  }`}
                >
                  <input
                    type="radio"
                    name="modRule"
                    checked={modAction === "WARN"}
                    onChange={() => {}}
                    className="sr-only"
                  />
                  <div className="w-4 h-4 rounded-full border border-slate-550 flex items-center justify-center mt-0.5 flex-shrink-0">
                    {modAction === "WARN" && <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 font-mono">ALLOW WITH WARNING (Shadow warning)</h3>
                    <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                      Publish content as is, but silently log safety violation strikes for dashboard review.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {settingsStatus && (
              <p className="text-xs text-violet-400 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {settingsStatus}
              </p>
            )}

            <button
              onClick={handleSaveSettings}
              disabled={isPending}
              className="w-full py-2 bg-violet-600 hover:bg-violet-500 font-bold text-xs text-white rounded-xl transition shadow"
            >
              Update Policy Settings
            </button>
          </div>
        </div>
      )}

      {/* Insert Add blocked word modal dialog */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-[#000]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b0c10] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center bg-white/[0.02] border-b border-white/5 p-4">
              <h2 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
                <Shield className="w-4 h-4 text-violet-400" />
                Add Prohibited Term
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewWord} className="p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                  Offensive Word / Phrase
                </label>
                <input
                  type="text"
                  placeholder="Enter word..."
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-1.5 focus:border-violet-500/50 outline-none text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                    Language
                  </label>
                  <select
                    value={newLang}
                    onChange={(e) => setNewLang(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-2 py-1.5 text-xs outline-none focus:border-violet-500/50"
                  >
                    <option value="en" className="bg-[#12121e]">English</option>
                    <option value="ar" className="bg-[#12121e]">Arabic</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-2 py-1.5 text-xs outline-none focus:border-violet-500/50"
                  >
                    <option value="INSULT" className="bg-[#12121e]">Insult</option>
                    <option value="PROFANITY" className="bg-[#12121e]">Profanity</option>
                    <option value="SEXUAL" className="bg-[#12121e]">Sexual</option>
                    <option value="HATE" className="bg-[#12121e]">Hate</option>
                    <option value="HARASSMENT" className="bg-[#12121e]">Harassment</option>
                    <option value="SPAM" className="bg-[#12121e]">Spam</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                    Severity
                  </label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-2 py-1.5 text-xs outline-none focus:border-violet-500/50"
                  >
                    <option value="LOW" className="bg-[#12121e]">Low</option>
                    <option value="MEDIUM" className="bg-[#12121e]">Medium</option>
                    <option value="HIGH" className="bg-[#12121e]">High</option>
                    <option value="CRITICAL" className="bg-[#12121e]">Critical</option>
                  </select>
                </div>
              </div>

              {addError && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {addError}
                </p>
              )}

              <div className="flex justify-end gap-2 border-t border-white/5 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 font-semibold text-xs text-white rounded-lg transition"
                >
                  Confirm Block
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
