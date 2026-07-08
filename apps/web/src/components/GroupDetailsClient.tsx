"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Users, Lock, Unlock, Shield, Calendar, Megaphone, FileText,
  UserCheck, AlertTriangle, Plus, Check, X, ArrowLeft, Send,
} from "lucide-react";
import {
  joinGroup,
  leaveGroup,
  createAnnouncement,
  createGroupRule,
  handleJoinRequest,
} from "@/server/actions/communities";
import { PostCard } from "./HomeFeed";

export default function GroupDetailsClient({
  group,
  currentUserId,
  pendingJoinRequests,
}: {
  group: any;
  currentUserId: string;
  pendingJoinRequests: any[];
}) {
  const [requests, setRequests] = useState<any[]>(pendingJoinRequests);
  const [members, setMembers] = useState<any[]>(group.members);
  const [announcements, setAnnouncements] = useState<any[]>(group.announcements);
  const [rules, setRules] = useState<any[]>(group.rules);

  const [activeTab, setActiveTab] = useState<"feed" | "announcements" | "rules" | "members" | "requests">("feed");

  // Auth checks
  const myMemberInfo = members.find((m) => m.userId === currentUserId);
  const isMember = !!myMemberInfo;
  const myRole = myMemberInfo?.role ?? ""; // ADMIN, MODERATOR, MEMBER
  const isAdminOrMod = ["ADMIN", "MODERATOR"].includes(myRole);

  const [isPending, startTransition] = useTransition();

  // Announcement composer
  const [annMsg, setAnnMsg] = useState("");
  const [ruleTitle, setRuleTitle] = useState("");
  const [ruleDesc, setRuleDesc] = useState("");

  const handleJoinLeave = () => {
    startTransition(async () => {
      if (isMember) {
        if (!confirm("Are you sure you want to leave this group?")) return;
        const res = await leaveGroup(group.id);
        if (res.success) {
          setMembers((prev) => prev.filter((m) => m.userId !== currentUserId));
        }
      } else {
        const res = await joinGroup(group.id);
        if (res.success) {
          if (res.status === "MEMBER" && res.member) {
            setMembers((prev) => [...prev, { ...res.member, user: { profile: { displayName: "You", username: "me" } } }]);
          } else {
            alert("Join request successfully queued.");
          }
        }
      }
    });
  };

  const handleApproveDenyRequest = (reqId: string, approve: boolean) => {
    startTransition(async () => {
      const res = await handleJoinRequest(reqId, approve);
      if (res.success) {
        const req = requests.find((r) => r.id === reqId);
        setRequests((prev) => prev.filter((r) => r.id !== reqId));
        if (approve && req) {
          setMembers((prev) => [...prev, { userId: req.userId, user: req.user, role: "MEMBER" }]);
        }
      }
    });
  };

  const handleAddAnnouncement = () => {
    if (!annMsg.trim()) return;
    startTransition(async () => {
      const res = await createAnnouncement(group.id, annMsg);
      if (res.success && res.announcement) {
        setAnnouncements((prev) => [res.announcement, ...prev]);
        setAnnMsg("");
      }
    });
  };

  const handleAddRule = () => {
    if (!ruleTitle.trim()) return;
    startTransition(async () => {
      const res = await createGroupRule(group.id, ruleTitle, ruleDesc);
      if (res.success && res.rule) {
        setRules((prev) => [...prev, res.rule]);
        setRuleTitle("");
        setRuleDesc("");
      }
    });
  };

  const isGroupAdmin = myRole === "ADMIN";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Back Link */}
        <Link href="/groups" className="flex items-center gap-1.5 text-zinc-550 hover:text-zinc-350 text-xs transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Communities
        </Link>

        {/* Group Banner Info */}
        <div className="glass border border-zinc-900 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 relative overflow-hidden">
          {group.coverUrl && (
            <div className="absolute inset-0 bg-cover bg-center opacity-10 pointer-events-none" style={{ backgroundImage: `url(${group.coverUrl})` }} />
          )}
          <div className="flex items-start gap-4 z-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-650 to-indigo-650 flex items-center justify-center flex-shrink-0">
              {group.coverUrl
                ? <img src={group.coverUrl} className="w-full h-full object-cover rounded-2xl" alt="" />
                : <Users className="w-8 h-8 text-white" />}
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {group.name}
                {group.isPrivate ? <Lock className="w-4 h-4 text-zinc-500" /> : <Unlock className="w-4 h-4 text-zinc-500" />}
              </h1>
              <p className="text-zinc-400 text-sm mt-1 max-w-xl">{group.description ?? "No description provided."}</p>
              <div className="flex items-center gap-4 text-xs text-zinc-650 mt-3 font-semibold">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {members.length} members</span>
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Launched {new Date(group.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleJoinLeave}
            disabled={isPending}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all z-10 flex-shrink-0 ${
              isMember
                ? "bg-zinc-900 border border-zinc-800 hover:border-red-500/20 text-zinc-400 hover:text-rose-450"
                : "gradient-btn text-white"
            }`}
          >
            {isMember ? "Leave Community" : group.isPrivate ? "Request Invite" : "Join Community"}
          </button>
        </div>

        {/* Tab menu */}
        <div className="flex gap-1 mb-6 bg-zinc-900/60 p-1.5 rounded-2xl overflow-x-auto">
          {[
            { id: "feed", label: "Group Board", icon: FileText },
            { id: "announcements", label: `Updates (${announcements.length})`, icon: Megaphone },
            { id: "rules", label: `Guidelines (${rules.length})`, icon: Shield },
            { id: "members", label: "Hub Members", icon: UserCheck },
            ...(isAdminOrMod
              ? [{ id: "requests", label: `Queued Requests (${requests.length})`, icon: AlertTriangle }]
              : []),
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold scroll-mx-4 transition-all flex-shrink-0 ${
                  activeTab === t.id ? "gradient-btn text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Visibility Wall */}
        {group.isPrivate && !isMember && (
          <div className="glass rounded-3xl p-16 text-center text-zinc-600 border border-zinc-900/80">
            <Lock className="w-12 h-12 opacity-15 mx-auto mb-3" />
            <p className="font-semibold text-zinc-500">Private Community Hub</p>
            <p className="text-xs mt-1 max-w-xs mx-auto">
              Join this group workspace to access the message board, announcements, and rule documentation.
            </p>
          </div>
        )}

        {/* Tab contents */}
        {(!group.isPrivate || isMember) && (
          <div className="space-y-6">
            {/* Group Feed tab */}
            {activeTab === "feed" && (
              <div className="space-y-4">
                {group.posts.length === 0 ? (
                  <div className="glass rounded-3xl p-16 text-center text-zinc-650 border border-zinc-900/80">
                    <FileText className="w-12 h-12 opacity-15 mx-auto mb-3" />
                    <p className="font-semibold text-zinc-550">Empty Community Feed</p>
                    <p className="text-xs mt-1 max-w-xs mx-auto">
                      There are no posts inside this board yet. Feel free to launch a conversation.
                    </p>
                  </div>
                ) : (
                  group.posts.map((post: any) => (
                    <PostCard key={post.id} post={post} currentUserId={currentUserId} />
                  ))
                )}
              </div>
            )}

            {/* Announcements tab */}
            {activeTab === "announcements" && (
              <div className="space-y-5">
                {/* Admin Composer */}
                {isAdminOrMod && (
                  <div className="glass border border-zinc-800 p-4 rounded-2xl space-y-3">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Megaphone className="w-4 h-4 text-violet-400" /> Dispatch Announcement
                    </h3>
                    <div className="relative">
                      <input
                        value={annMsg}
                        onChange={(e) => setAnnMsg(e.target.value)}
                        placeholder="Pin a message to all community members..."
                        className="w-full bg-zinc-950 border border-zinc-850 focus:border-violet-500 rounded-xl pl-4 pr-12 py-3 text-sm outline-none text-zinc-200"
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddAnnouncement(); }}
                      />
                      <button
                        onClick={handleAddAnnouncement}
                        disabled={isPending || !annMsg.trim()}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg gradient-btn flex items-center justify-center text-white disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Lists */}
                {announcements.length === 0 ? (
                  <div className="glass rounded-3xl p-16 text-center text-zinc-650 border border-zinc-900/80">
                    <Megaphone className="w-12 h-12 opacity-15 mx-auto mb-3" />
                    <p className="font-semibold text-zinc-550">No announcements yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {announcements.map((ann) => (
                      <div key={ann.id} className="glass border border-zinc-900 p-5 rounded-2xl">
                        <p className="text-sm text-zinc-200">{ann.content}</p>
                        <span className="text-[10px] text-zinc-600 block mt-3 font-semibold">
                          Posted on {new Date(ann.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Rules tab */}
            {activeTab === "rules" && (
              <div className="space-y-5">
                {/* Rule Composer (only ADMIN can write rules) */}
                {isGroupAdmin && (
                  <div className="glass border border-zinc-800 p-5 rounded-2xl space-y-4">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-violet-400" /> Create Guideline Rule
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        value={ruleTitle}
                        onChange={(e) => setRuleTitle(e.target.value)}
                        placeholder="Rule Title"
                        className="bg-zinc-950 border border-zinc-850 focus:border-violet-500 rounded-xl px-4 py-2.5 text-sm outline-none text-zinc-200"
                      />
                      <input
                        value={ruleDesc}
                        onChange={(e) => setRuleDesc(e.target.value)}
                        placeholder="Short description (optional)"
                        className="bg-zinc-950 border border-zinc-850 focus:border-violet-500 rounded-xl px-4 py-2.5 text-sm outline-none text-zinc-200"
                      />
                    </div>
                    <button
                      onClick={handleAddRule}
                      disabled={isPending || !ruleTitle.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl gradient-btn text-white text-xs font-semibold disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Rule
                    </button>
                  </div>
                )}

                {/* List rules */}
                {rules.length === 0 ? (
                  <div className="glass rounded-3xl p-16 text-center text-zinc-650 border border-zinc-900/80">
                    <Shield className="w-12 h-12 opacity-15 mx-auto mb-3" />
                    <p className="font-semibold text-zinc-550">No rules configured yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rules.map((rule, idx) => (
                      <div key={rule.id} className="glass border border-zinc-900 p-5 rounded-2xl flex items-start gap-4">
                        <span className="w-7 h-7 rounded-lg bg-zinc-900 flex items-center justify-center text-xs font-bold text-violet-400 border border-zinc-800">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-bold text-sm text-zinc-250">{rule.title}</p>
                          {rule.description && <p className="text-xs text-zinc-500 mt-1 max-w-xl">{rule.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Members tab */}
            {activeTab === "members" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {members.map((m) => {
                  const prof = m.user?.profile;
                  return (
                    <div key={m.userId} className="glass border border-zinc-900/60 p-4 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 overflow-hidden">
                          {prof?.avatarUrl
                            ? <img src={prof.avatarUrl} className="w-full h-full object-cover" alt="" />
                            : <div className="w-full h-full flex items-center justify-center text-white font-bold text-xs">{prof?.displayName?.[0] ?? "U"}</div>}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{prof?.displayName ?? "Member"}</p>
                          <p className="text-xs text-zinc-600">@{prof?.username ?? "username"}</p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                        m.role === "ADMIN"
                          ? "bg-violet-500/10 border-violet-500/20 text-violet-400"
                          : m.role === "MODERATOR"
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-450"
                          : "bg-zinc-800 border-zinc-700 text-zinc-500"
                      }`}>
                        {m.role}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Join Requests tab (Admins only) */}
            {activeTab === "requests" && isAdminOrMod && (
              <div className="space-y-3">
                {requests.length === 0 ? (
                  <div className="glass rounded-3xl p-16 text-center text-zinc-650 border border-zinc-900/80">
                    <Check className="w-12 h-12 opacity-15 mx-auto mb-3 text-emerald-400" />
                    <p className="font-semibold text-zinc-550">Queue Clear</p>
                    <p className="text-xs mt-1">There are no pending join requests for this community.</p>
                  </div>
                ) : (
                  requests.map((req) => {
                    const prof = req.user?.profile;
                    return (
                      <div key={req.id} className="glass border border-zinc-900 p-4 rounded-xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-550 to-pink-550 overflow-hidden">
                            {prof?.avatarUrl
                              ? <img src={prof.avatarUrl} className="w-full h-full object-cover" alt="" />
                              : <div className="w-full h-full flex items-center justify-center text-white font-bold text-xs">{prof?.displayName?.[0]}</div>}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{prof?.displayName}</p>
                            <p className="text-xs text-zinc-600">Requested {new Date(req.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveDenyRequest(req.id, true)}
                            className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white transition-all"
                            title="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleApproveDenyRequest(req.id, false)}
                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500 text-rose-400 hover:text-white transition-all"
                            title="Deny"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
