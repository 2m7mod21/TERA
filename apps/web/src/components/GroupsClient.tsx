"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Users, Plus, Compass, Lock, Unlock,
  X, Image as ImageIcon, Globe, ArrowRight,
} from "lucide-react";
import { createGroup, joinGroup } from "@/server/actions/communities";

export default function GroupsClient({
  joinedGroups,
  exploreGroups,
}: {
  joinedGroups: any[];
  exploreGroups: any[];
}) {
  const [joined, setJoined] = useState<any[]>(joinedGroups);
  const [explore, setExplore] = useState<any[]>(exploreGroups);
  const [activeTab, setActiveTab] = useState<"joined" | "explore">("joined");

  // Create Modal
  const [openModal, setOpenModal] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [coverUrl, setCoverUrl] = useState("");

  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await createGroup(name, desc, isPrivate, coverUrl);
      if (res.success && res.group) {
        setJoined((prev) => [res.group, ...prev]);
        setName("");
        setDesc("");
        setCoverUrl("");
        setIsPrivate(false);
        setOpenModal(false);
      }
    });
  };

  const handleJoin = (groupId: string) => {
    startTransition(async () => {
      const res = await joinGroup(groupId);
      if (res.success) {
        // Move from explore to joined if public
        const target = explore.find((g) => g.id === groupId);
        if (target) {
          if (res.status === "MEMBER") {
            setJoined((prev) => [...prev, { ...target, _count: { members: (target._count?.members || 0) + 1 } }]);
            setExplore((prev) => prev.filter((g) => g.id !== groupId));
          } else {
            // Pending request — just mark as joining or remove action
            alert("Join request sent to group admins.");
          }
        }
      }
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">← Feed</Link>
            <h1 className="text-2xl font-bold gradient-text mt-1 flex items-center gap-2">
              <Users className="w-6 h-6" /> Communities & Groups
            </h1>
          </div>
          <button
            onClick={() => setOpenModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl gradient-btn text-white text-sm font-semibold shadow-md hover:shadow-violet-500/10 transition-all"
          >
            <Plus className="w-4 h-4" /> Create Group
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-zinc-900 p-1 rounded-2xl max-w-sm">
          {[
            { id: "joined", label: `My Groups (${joined.length})`, icon: Users },
            { id: "explore", label: "Explore", icon: Compass },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === t.id ? "gradient-btn text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content list */}
        {activeTab === "joined" ? (
          joined.length === 0 ? (
            <div className="glass rounded-3xl p-16 text-center text-zinc-650 border border-zinc-900/80">
              <Users className="w-12 h-12 opacity-15 mx-auto mb-3" />
              <p className="font-semibold text-zinc-550">Not inside any communities yet</p>
              <p className="text-xs mt-1 max-w-xs mx-auto mb-4">
                Explore open hubs or deploy a new group of your own.
              </p>
              <button onClick={() => setActiveTab("explore")} className="text-xs text-violet-400 hover:text-violet-300 transition-colors font-semibold">
                Explore Communities →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {joined.map((group) => (
                <Link
                  key={group.id}
                  href={`/groups/${group.id}`}
                  className="glass border border-zinc-900 hover:border-zinc-800 rounded-2xl p-5 flex items-start gap-4 hover:bg-zinc-900/30 transition-all group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-650 to-indigo-650 flex items-center justify-center flex-shrink-0">
                    {group.coverUrl
                      ? <img src={group.coverUrl} className="w-full h-full object-cover rounded-2xl" alt="" />
                      : <Users className="w-6 h-6 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-zinc-200 group-hover:text-violet-400 truncate">{group.name}</p>
                      {group.isPrivate ? <Lock className="w-3 h-3 text-zinc-600" /> : <Unlock className="w-3 h-3 text-zinc-600" />}
                    </div>
                    <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5">{group.description ?? "No description provided."}</p>
                    <p className="text-[10px] text-zinc-600 mt-2 font-semibold">{(group._count?.members ?? 0).toLocaleString()} members</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-zinc-700 self-center group-hover:text-violet-400 group-hover:translate-x-1 transition-all flex-shrink-0" />
                </Link>
              ))}
            </div>
          )
        ) : (
          explore.length === 0 ? (
            <div className="glass rounded-3xl p-16 text-center text-zinc-650 border border-zinc-900/80">
              <Compass className="w-12 h-12 opacity-15 mx-auto mb-3" />
              <p className="font-semibold text-zinc-550">No other groups found</p>
              <p className="text-xs mt-1 max-w-xs mx-auto">
                You've joined all available public servers on Nexus.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {explore.map((group) => (
                <div
                  key={group.id}
                  className="glass border border-zinc-902 rounded-2xl p-5 flex items-start gap-4 hover:border-zinc-800/80 transition-all hover:bg-zinc-900/30 group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-650 to-indigo-650 flex items-center justify-center flex-shrink-0">
                    {group.coverUrl
                      ? <img src={group.coverUrl} className="w-full h-full object-cover rounded-2xl" alt="" />
                      : <Compass className="w-6 h-6 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-zinc-200 truncate">{group.name}</p>
                      {group.isPrivate ? <Lock className="w-3 h-3 text-zinc-600" /> : <Unlock className="w-3 h-3 text-zinc-600" />}
                    </div>
                    <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5">{group.description ?? "No description provided."}</p>
                    <div className="flex items-center justify-between mt-3 gap-2">
                      <span className="text-[10px] text-zinc-650 font-semibold">{group._count?.members ?? 0} members</span>
                      <button
                        onClick={() => handleJoin(group.id)}
                        disabled={isPending}
                        className="px-3.5 py-1 rounded-xl bg-zinc-800 hover:bg-violet-600 text-xs font-semibold text-zinc-300 hover:text-white transition-all shadow-sm"
                      >
                        {group.isPrivate ? "Request" : "Join"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Group Creation Modal */}
      {openModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass border border-zinc-800 rounded-3xl p-6 w-full max-w-lg animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-zinc-200">Create Community Group</h3>
              <button onClick={() => setOpenModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-550 uppercase tracking-widest mb-1.5">Group Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Nexus Developers, Gamer Lobby"
                  className="w-full bg-zinc-950 border border-zinc-850 focus:border-violet-500 rounded-xl px-4 py-2.5 outline-none text-zinc-200 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-550 uppercase tracking-widest mb-1.5">Description</label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Explain group topics, guidelines and goals..."
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-850 focus:border-violet-500 rounded-xl px-4 py-2.5 outline-none text-zinc-200 transition-all text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-550 uppercase tracking-widest mb-1.5">Cover Image URL (optional)</label>
                <div className="relative">
                  <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input
                    type="text"
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    placeholder="https://example.com/cover.jpg"
                    className="w-full bg-zinc-950 border border-zinc-850 focus:border-violet-500 rounded-xl pl-11 pr-4 py-2.5 outline-none text-zinc-200 transition-all text-sm"
                  />
                </div>
              </div>

              {/* Private flag */}
              <div className="glass border border-zinc-850 p-4 rounded-xl flex items-center justify-between">
                <div className="flex gap-3">
                  <div className="p-2 rounded-lg bg-zinc-800 flex-shrink-0 self-start">
                    {isPrivate ? <Lock className="w-4 h-4 text-violet-400" /> : <Globe className="w-4 h-4 text-violet-400" />}
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-zinc-250 block">Private Community</label>
                    <span className="text-[10px] text-zinc-500 mt-0.5 block">
                      {isPrivate ? "Members require admin approval to check feeds." : "Anyone can check feeds and join immediately."}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsPrivate(!isPrivate)}
                  className={`w-12 h-6.5 rounded-full p-1 transition-all ${
                    isPrivate ? "bg-violet-600 flex justify-end" : "bg-zinc-800 flex justify-start"
                  }`}
                >
                  <div className="w-4.5 h-4.5 rounded-full bg-white shadow" />
                </button>
              </div>

              <button
                onClick={handleCreate}
                disabled={isPending || !name.trim()}
                className="w-full py-3 rounded-xl gradient-btn text-white font-semibold text-sm shadow-md hover:shadow-violet-500/10 disabled:opacity-50 transition-all mt-2"
              >
                {isPending ? "Deploying Community..." : "Create Group"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
