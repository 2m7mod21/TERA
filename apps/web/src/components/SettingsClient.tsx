"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  User, Shield, Bell, Eye, Paintbrush, ChevronRight, CheckCircle2,
  AlertCircle, Lock, Mail, UserCheck, EyeOff, Moon, Sun, Monitor,
} from "lucide-react";
import {
  updateAccountSettings,
  updatePrivacySettings,
  updateSecuritySettings,
  updateAppearanceSettings,
  updateNotificationPreference,
  updateMessagingPrivacySettings,
} from "@/server/actions/settings";
import { updateMentionPrivacy } from "@/server/actions/mentions";

type Tab = "account" | "privacy" | "security" | "notifications" | "appearance";

export default function SettingsClient({
  initialSettings,
}: {
  initialSettings: any;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("account");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form states
  const [displayName, setDisplayName] = useState(initialSettings?.profile?.displayName ?? "");
  const [email, setEmail] = useState(initialSettings?.email ?? "");
  const [password, setPassword] = useState("");
  const [privacyLevel, setPrivacyLevel] = useState(initialSettings?.profile?.privacyLevel ?? "PUBLIC");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(initialSettings?.twoFactorEnabled ?? false);
  const [showOnlineStatus, setShowOnlineStatus] = useState(initialSettings?.showOnlineStatus ?? "EVERYONE");
  const [showLastSeen, setShowLastSeen] = useState(initialSettings?.showLastSeen ?? "EVERYONE");
  const [showReadReceipts, setShowReadReceipts] = useState(initialSettings?.showReadReceipts ?? true);
  const [showTypingIndicator, setShowTypingIndicator] = useState(initialSettings?.showTypingIndicator ?? true);
  const [mentionPrivacy, setMentionPrivacy] = useState<"EVERYONE" | "FOLLOWING" | "NOBODY">(initialSettings?.profile?.mentionPrivacy ?? "EVERYONE");

  // Appearance
  const [theme, setTheme] = useState(initialSettings?.appearanceSetting?.theme ?? "SYSTEM");
  const [fontSize, setFontSize] = useState(initialSettings?.appearanceSetting?.fontSize ?? "MEDIUM");
  const [reducedMotion, setReducedMotion] = useState(initialSettings?.appearanceSetting?.reducedMotion ?? false);

  // Notifications preferences map
  const initialPrefs = initialSettings?.notificationPrefs || [];
  const getPref = (cat: string, type: "push" | "email") => {
    const p = initialPrefs.find((x: any) => x.category === cat);
    if (!p) return true; // default true
    return type === "push" ? p.push : p.email;
  };

  const [notifState, setNotifState] = useState<Record<string, { push: boolean; email: boolean }>>({
    LIKES: { push: getPref("LIKES", "push"), email: getPref("LIKES", "email") },
    COMMENTS: { push: getPref("COMMENTS", "push"), email: getPref("COMMENTS", "email") },
    FOLLOWS: { push: getPref("FOLLOWS", "push"), email: getPref("FOLLOWS", "email") },
    MESSAGES: { push: getPref("MESSAGES", "push"), email: getPref("MESSAGES", "email") },
    MENTIONS: { push: getPref("MENTIONS", "push"), email: getPref("MENTIONS", "email") },
  });

  const showMsg = (text: string, type: "success" | "error" = "success") => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSaveAccount = () => {
    startTransition(async () => {
      const res = await updateAccountSettings({ displayName, email, password: password || undefined });
      if (res.success) {
        showMsg("Account settings updated successfully!");
        setPassword("");
      } else {
        showMsg(res.error || "Failed to update settings", "error");
      }
    });
  };

  const handleSavePrivacy = (val: string) => {
    setPrivacyLevel(val);
    startTransition(async () => {
      const res = await updatePrivacySettings({ privacyLevel: val as any });
      if (res.success) showMsg("Privacy profile visibility updated!");
      else showMsg("Failed to update privacy level", "error");
    });
  };

  const handleUpdateMessagingPrivacy = (updates: {
    showOnlineStatus?: "EVERYONE" | "FRIENDS" | "NOBODY";
    showLastSeen?: "EVERYONE" | "FRIENDS" | "NOBODY";
    showReadReceipts?: boolean;
    showTypingIndicator?: boolean;
  }) => {
    startTransition(async () => {
      const res = await updateMessagingPrivacySettings(updates);
      if (res.success) {
        showMsg("Chat privacy settings updated successfully!");
      } else {
        showMsg("Failed to update chat privacy settings", "error");
      }
    });
  };

  const handleToggle2FA = () => {
    const nextVal = !twoFactorEnabled;
    setTwoFactorEnabled(nextVal);
    startTransition(async () => {
      const res = await updateSecuritySettings({ twoFactorEnabled: nextVal });
      if (res.success) showMsg(nextVal ? "2FA enabled!" : "2FA disabled!");
      else showMsg("Security update failed", "error");
    });
  };

  const handleAppearance = (themeVal: string, fontVal: string, motionVal: boolean) => {
    setTheme(themeVal);
    setFontSize(fontVal);
    setReducedMotion(motionVal);
    startTransition(async () => {
      const res = await updateAppearanceSettings({ theme: themeVal, fontSize: fontVal, reducedMotion: motionVal });
      if (res.success) showMsg("Appearance settings applied!");
    });
  };

  const handleNotificationToggle = (category: string, type: "push" | "email") => {
    const current = notifState[category] || { push: true, email: true };
    const updated = { ...current, [type]: !current[type] };
    setNotifState((prev: any) => ({ ...prev, [category]: updated }));

    startTransition(async () => {
      const res = await updateNotificationPreference(category as any, updated);
      if (!res.success) showMsg("Failed to update notification preferences", "error");
    });
  };

  // Nav labels
  const navItems: { id: Tab; label: string; icon: React.ElementType; desc: string }[] = [
    { id: "account", label: "Account Info", icon: User, desc: "Personal info, email, password" },
    { id: "privacy", label: "Privacy Settings", icon: Eye, desc: "Manage profile visibility & limits" },
    { id: "security", label: "Security & Login", icon: Shield, desc: "Control security preferences & 2FA" },
    { id: "notifications", label: "Notifications", icon: Bell, desc: "Choose email & push categories" },
    { id: "appearance", label: "Appearance", icon: Paintbrush, desc: "Customize layouts, themes, font sizes" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-8">
        
        {/* Sidebar navigation */}
        <div className="w-full md:w-80 flex-shrink-0">
          <div className="mb-6">
            <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">← Feed</Link>
            <h1 className="text-2xl font-bold gradient-text mt-1">Settings</h1>
          </div>
          <div className="space-y-1 bg-zinc-900/50 p-2 rounded-2xl border border-zinc-800/80">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all ${
                    activeTab === item.id
                      ? "gradient-btn text-white shadow-lg"
                      : "hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className={`text-[10px] ${activeTab === item.id ? "text-white/70" : "text-zinc-600"}`}>
                        {item.desc}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Setting content panels */}
        <div className="flex-1 bg-zinc-900/30 border border-zinc-800 rounded-3xl p-6 md:p-8 min-h-[500px]">
          {/* Status Message toast */}
          {message && (
            <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 border ${
              message.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                : "bg-red-500/10 border-red-500/20 text-rose-300"
            }`}>
              {message.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="text-sm font-medium">{message.text}</span>
            </div>
          )}

          {/* Account Tab */}
          {activeTab === "account" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-100">
                <User className="w-5 h-5 text-violet-400" /> Account Settings
              </h2>
              <p className="text-sm text-zinc-500">Update your account information and password.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Display Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="My display name"
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-violet-500 rounded-xl pl-11 pr-4 py-2.5 outline-none text-zinc-200 transition-all text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@nexus.com"
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-violet-500 rounded-xl pl-11 pr-4 py-2.5 outline-none text-zinc-200 transition-all text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Change Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="•••••••• (leave blank to keep unchanged)"
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-violet-500 rounded-xl pl-11 pr-4 py-2.5 outline-none text-zinc-200 transition-all text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleSaveAccount}
                  disabled={isPending}
                  className="gradient-btn text-white px-6 py-2.5 rounded-xl font-semibold text-sm shadow-md hover:shadow-violet-500/20 disabled:opacity-50 transition-all"
                >
                  {isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}

          {/* Privacy Tab */}
          {activeTab === "privacy" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-100">
                <Eye className="w-5 h-5 text-pink-400" /> Privacy & Auditing
              </h2>
              <p className="text-sm text-zinc-500">Determine who can see your profile page and content posts.</p>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { val: "PUBLIC", label: "Public Profile", desc: "Anyone on Nexus can view your profile, posts, and feeds.", icon: Eye },
                    { val: "FRIENDS", label: "Friends Only", desc: "Only accepted mutual followers can view your content.", icon: UserCheck },
                    { val: "PRIVATE", label: "Private Account", desc: "All details are locked. Users can request follow approvals.", icon: EyeOff },
                  ].map((level) => {
                    const HIcon = level.icon;
                    return (
                      <button
                        key={level.val}
                        onClick={() => handleSavePrivacy(level.val)}
                        className={`text-left p-4 rounded-2xl border transition-all flex items-start gap-4 ${
                          privacyLevel === level.val
                            ? "border-pink-500 bg-pink-500/5 text-pink-300"
                            : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 text-zinc-400"
                        }`}
                      >
                        <div className={`p-2 rounded-xl flex-shrink-0 ${
                          privacyLevel === level.val ? "bg-pink-500 text-white" : "bg-zinc-800 text-zinc-400"
                        }`}>
                          <HIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-150">{level.label}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">{level.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Messaging & Presence Privacy Settings */}
              <div className="border-t border-zinc-800/80 pt-6 mt-6 space-y-6">
                <div>
                  <h3 className="text-md font-bold text-zinc-200">Chat Presence & Receipts</h3>
                  <p className="text-xs text-zinc-500 mt-1">Control who can see your online status, typing status, and read activity.</p>
                </div>

                <div className="space-y-4">
                  {/* Show Online Status */}
                  <div className="glass border border-zinc-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-zinc-200">Show Online Status</p>
                        <p className="text-xs text-zinc-500 mt-1">Controls who can see when you are active and online.</p>
                      </div>
                      <select
                        value={showOnlineStatus}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setShowOnlineStatus(val);
                          handleUpdateMessagingPrivacy({ showOnlineStatus: val });
                        }}
                        className="bg-zinc-900 border border-zinc-700/60 rounded-xl px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-pink-500 transition-colors"
                      >
                        <option value="EVERYONE">Everyone</option>
                        <option value="FRIENDS">Followers/Friends Only</option>
                        <option value="NOBODY">Nobody</option>
                      </select>
                    </div>
                  </div>

                  {/* Show Last Seen */}
                  <div className="glass border border-zinc-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-zinc-200">Show Last Seen Time</p>
                        <p className="text-xs text-zinc-500 mt-1">Controls who can see the timestamp when you last came offline.</p>
                      </div>
                      <select
                        value={showLastSeen}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setShowLastSeen(val);
                          handleUpdateMessagingPrivacy({ showLastSeen: val });
                        }}
                        className="bg-zinc-900 border border-zinc-700/60 rounded-xl px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-pink-500 transition-colors"
                      >
                        <option value="EVERYONE">Everyone</option>
                        <option value="FRIENDS">Followers/Friends Only</option>
                        <option value="NOBODY">Nobody</option>
                      </select>
                    </div>
                  </div>

                  {/* Read Receipts */}
                  <div className="glass border border-zinc-800 rounded-2xl p-5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-zinc-200">Read Receipts</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        If disabled, you won't send or receive Read Receipts. Read Receipts are always sent for group chats.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const nextVal = !showReadReceipts;
                        setShowReadReceipts(nextVal);
                        handleUpdateMessagingPrivacy({ showReadReceipts: nextVal });
                      }}
                      className={`w-12 h-6.5 rounded-full p-1 transition-all ${
                        showReadReceipts ? "bg-pink-500 flex justify-end" : "bg-zinc-800 flex justify-start"
                      }`}
                    >
                      <div className="w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform" />
                    </button>
                  </div>

                  {/* Typing Indicator */}
                  <div className="glass border border-zinc-800 rounded-2xl p-5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-zinc-250">Typing Indicator</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Let other users see when you are typing a message. If disabled, your typing status won't be broadcasted.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const nextVal = !showTypingIndicator;
                        setShowTypingIndicator(nextVal);
                        handleUpdateMessagingPrivacy({ showTypingIndicator: nextVal });
                      }}
                      className={`w-12 h-6.5 rounded-full p-1 transition-all ${
                        showTypingIndicator ? "bg-pink-500 flex justify-end" : "bg-zinc-800 flex justify-start"
                      }`}
                    >
                      <div className="w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform" />
                    </button>
                  </div>

                </div>
              </div>

              {/* Mention Privacy Settings */}
              <div className="border-t border-zinc-800/80 pt-6 mt-6 space-y-6">
                <div>
                  <h3 className="text-md font-bold text-zinc-200">Mentions & Tagging</h3>
                  <p className="text-xs text-zinc-500 mt-1">Control who can tag or mention you in posts, comments, and stories.</p>
                </div>

                <div className="glass border border-zinc-800 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-semibold text-zinc-200">Who can @mention you</p>
                      <p className="text-xs text-zinc-500 mt-0.5">Select who is allowed to mention your username.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {([
                      { val: "EVERYONE", label: "Everyone", desc: "Anyone can tag you" },
                      { val: "FOLLOWING", label: "People You Follow", desc: "Only users you follow" },
                      { val: "NOBODY", label: "Nobody", desc: "Disable all mentions" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.val}
                        onClick={() => {
                          setMentionPrivacy(opt.val);
                          startTransition(async () => {
                            const res = await updateMentionPrivacy(opt.val);
                            if (res.success) {
                              showMsg("Mention privacy updated successfully!");
                            } else {
                              showMsg(res.error || "Failed to update mention privacy", "error");
                            }
                          });
                        }}
                        className={`text-left p-4 rounded-xl border transition-all ${
                          mentionPrivacy === opt.val
                            ? "border-violet-500 bg-violet-500/5 text-violet-300"
                            : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 text-zinc-400"
                        }`}
                      >
                        <p className="text-sm font-bold">{opt.label}</p>
                        <p className="text-[10px] text-zinc-500 mt-1">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-100">
                <Shield className="w-5 h-5 text-indigo-400" /> Security Settings
              </h2>
              <p className="text-sm text-zinc-500">Set authentication guards to secure your personal workspace.</p>

              <div className="glass border border-zinc-800 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-200">Two-Factor Authentication (2FA)</p>
                  <p className="text-xs text-zinc-500 mt-1 max-w-md">
                    Secure your cabinet with mandatory codes when logging in from new devices.
                  </p>
                </div>
                <button
                  onClick={handleToggle2FA}
                  className={`w-12 h-6.5 rounded-full p-1 transition-all ${
                    twoFactorEnabled ? "bg-violet-600 flex justify-end" : "bg-zinc-800 flex justify-start"
                  }`}
                >
                  <div className="w-4.5 h-4.5 rounded-full bg-white shadow-md" />
                </button>
              </div>

              {twoFactorEnabled && (
                <div className="p-4 rounded-xl bg-violet-600/5 border border-violet-600/20 text-xs text-violet-400">
                  <p className="font-semibold">Note on 2FA:</p>
                  <p className="mt-1">
                    When logging in, verification codes will be computed and requested using your authenticator application.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-100">
                <Bell className="w-5 h-5 text-emerald-400" /> Notifications Manager
              </h2>
              <p className="text-sm text-zinc-500">Determine which interactions send alerts to you (Push vs Email).</p>

              <div className="space-y-2.5">
                {[
                  { id: "LIKES", label: "Post Reactions", desc: "Likes, hearts, and reactions to your content" },
                  { id: "COMMENTS", label: "Comments & Replies", desc: "Replies, mentions, and threads to public activities" },
                  { id: "FOLLOWS", label: "New Followers", desc: "Follow queries, profile views, and friendship confirmations" },
                  { id: "MESSAGES", label: "Direct Messages", desc: "Direct threads and group communication invites" },
                  { id: "MENTIONS", label: "Mentions", desc: "Mentions inside post compose captions" },
                ].map((item) => {
                  const state = notifState[item.id] || { push: true, email: true };
                  return (
                    <div key={item.id} className="glass border border-zinc-850 p-4 rounded-2xl flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-zinc-200">{item.label}</p>
                        <p className="text-xs text-zinc-550">{item.desc}</p>
                      </div>
                      <div className="flex gap-4">
                        <button
                          onClick={() => handleNotificationToggle(item.id, "push")}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                            state.push
                              ? "bg-zinc-800 border-emerald-500/30 text-emerald-400"
                              : "border-zinc-800 text-zinc-500 hover:text-zinc-400"
                          }`}
                        >
                          Push
                        </button>
                        <button
                          onClick={() => handleNotificationToggle(item.id, "email")}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                            state.email
                              ? "bg-zinc-800 border-emerald-500/30 text-emerald-400"
                              : "border-zinc-800 text-zinc-500 hover:text-zinc-400"
                          }`}
                        >
                          Email
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-100">
                <Paintbrush className="w-5 h-5 text-amber-400" /> Theme & Canvas Layout
              </h2>
              <p className="text-sm text-zinc-500">Decorate theme variants, scaling thresholds and speed behaviors.</p>

              <div className="space-y-5">
                {/* Theme Selector */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2.5">Color Palette Modality</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: "LIGHT", label: "Light Mode", icon: Sun },
                      { val: "DARK", label: "Dark Mode", icon: Moon },
                      { val: "SYSTEM", label: "Sync Device Setting", icon: Monitor },
                    ].map((mode) => {
                      const TIcon = mode.icon;
                      return (
                        <button
                          key={mode.val}
                          onClick={() => handleAppearance(mode.val, fontSize, reducedMotion)}
                          className={`py-3.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 text-xs font-medium ${
                            theme === mode.val
                              ? "border-amber-500 bg-amber-500/5 text-amber-300 font-semibold"
                              : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 text-zinc-500"
                          }`}
                        >
                          <TIcon className="w-4 h-4" />
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Font Scaling */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2.5">Text Sizing Scale</label>
                  <div className="flex gap-2 bg-zinc-950/60 p-1.5 rounded-2xl border border-zinc-850">
                    {["SMALL", "MEDIUM", "LARGE"].map((sz) => (
                      <button
                        key={sz}
                        onClick={() => handleAppearance(theme, sz, reducedMotion)}
                        className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                          fontSize === sz ? "background shadow-md bg-zinc-850 text-zinc-100 font-semibold" : "text-zinc-500 hover:text-zinc-350"
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Performance switches */}
                <div className="glass border border-zinc-805 p-5 rounded-2xl flex items-center justify-between">
                  <div>
                    <label className="text-sm font-semibold text-zinc-200">Reduce Frame Motions</label>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Reduce heavy motion effects, layout transitions and ambient blur filters.
                    </p>
                  </div>
                  <button
                    onClick={() => handleAppearance(theme, fontSize, !reducedMotion)}
                    className={`w-12 h-6.5 rounded-full p-1 transition-all ${
                      reducedMotion ? "bg-amber-600 flex justify-end" : "bg-zinc-800 flex justify-start"
                    }`}
                  >
                    <div className="w-4.5 h-4.5 rounded-full bg-white shadow-md" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
