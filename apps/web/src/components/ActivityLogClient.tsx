"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Activity, Trash2, Clock, Filter, FileText, Heart, MessageSquare,
  Share2, Bookmark, Eye, LogIn, LogOut, Search, UserPlus, Send,
} from "lucide-react";
import { clearActivityLog, getActivityLog } from "@/server/actions/activity";

const LOG_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  POST_CREATED: { label: "Created a post", icon: FileText, color: "bg-blue-500/10 text-blue-400" },
  POST_LIKED: { label: "Liked a post", icon: Heart, color: "bg-rose-500/10 text-rose-450" },
  POST_COMMENTED: { label: "Commented on a post", icon: MessageSquare, color: "bg-teal-500/10 text-teal-400" },
  POST_SHARED: { label: "Shared a post", icon: Share2, color: "bg-indigo-500/10 text-indigo-455" },
  POST_SAVED: { label: "Saved a post to canvas", icon: Bookmark, color: "bg-violet-500/10 text-violet-400" },
  STORY_VIEWED: { label: "Viewed a story", icon: Eye, color: "bg-pink-500/10 text-pink-400" },
  SESSION_START: { label: "Logged into account", icon: LogIn, color: "bg-emerald-500/10 text-emerald-400" },
  SESSION_END: { label: "Logged out of account", icon: LogOut, color: "bg-zinc-550/10 text-zinc-400" },
  SEARCH: { label: "Executed search query", icon: Search, color: "bg-amber-500/10 text-amber-400" },
  FOLLOW: { label: "Followed a user", icon: UserPlus, color: "bg-violet-500/10 text-violet-400" },
  MESSAGE_SENT: { label: "Sent a message", icon: Send, color: "bg-green-500/10 text-green-450" },
};

function formatTime(date: Date | string) {
  return new Date(date).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ActivityLogClient({
  initialEvents,
}: {
  initialEvents: any[];
}) {
  const [events, setEvents] = useState<any[]>(initialEvents);
  const [filter, setFilter] = useState("ALL");
  const [isPending, startTransition] = useTransition();

  const handleClear = () => {
    if (!confirm("Are you sure you want to permanently clear your activity log? This cannot be undone.")) return;
    startTransition(async () => {
      const res = await clearActivityLog();
      if (res.success) setEvents([]);
    });
  };

  const handleFilterChange = (val: string) => {
    setFilter(val);
    startTransition(async () => {
      const filtered = await getActivityLog(val);
      setEvents(filtered);
    });
  };

  const FILTERS = [
    { value: "ALL", label: "All Events" },
    { value: "POST_CREATED", label: "Posts" },
    { value: "POST_LIKED", label: "Likes" },
    { value: "POST_COMMENTED", label: "Comments" },
    { value: "FOLLOW", label: "Follows" },
    { value: "SEARCH", label: "Searches" },
    { value: "SESSION_START", label: "Logins" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">← Feed</Link>
            <h1 className="text-2xl font-bold gradient-text mt-1 flex items-center gap-2">
              <Activity className="w-6 h-6" /> Activity Log
            </h1>
          </div>
          {events.length > 0 && (
            <button
              onClick={handleClear}
              disabled={isPending}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-red-500/20 text-zinc-400 hover:text-rose-400 text-sm font-semibold transition-all"
            >
              <Trash2 className="w-4 h-4" /> Clear Log
            </button>
          )}
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className="md:col-span-1 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" /> Category Filters
            </h2>
            <div className="space-y-1">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => handleFilterChange(f.value)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all ${
                    filter === f.value
                      ? "bg-zinc-800 text-zinc-100 font-semibold shadow"
                      : "text-zinc-550 hover:bg-zinc-900/40 hover:text-zinc-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline of Logs */}
          <div className="md:col-span-3">
            {isPending ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : events.length === 0 ? (
              <div className="glass rounded-3xl p-16 text-center text-zinc-600 border border-zinc-900/80">
                <Activity className="w-12 h-12 opacity-15 mx-auto mb-3" />
                <p className="font-semibold text-zinc-500">No activities found</p>
                <p className="text-xs mt-1 max-w-xs mx-auto">
                  Activities like reactions, follow queries and comments will be automatically audited here.
                </p>
              </div>
            ) : (
              <div className="relative border-l-2 border-zinc-900 ml-4 pl-6 space-y-6">
                {events.map((ev) => {
                  const cfg = LOG_CONFIG[ev.type] ?? {
                    label: ev.type.replace(/_/g, " "),
                    icon: Clock,
                    color: "bg-zinc-800 text-zinc-400",
                  };
                  const Icon = cfg.icon;
                  const meta = ev.meta ? JSON.parse(ev.meta) : {};

                  return (
                    <div key={ev.id} className="relative group">
                      {/* Timeline Node Icon */}
                      <div className={`absolute -left-[35px] top-0 w-6 h-6 rounded-full flex items-center justify-center border border-zinc-950 shadow-md ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
                      </div>

                      {/* Content Block */}
                      <div className="glass border border-transparent group-hover:border-zinc-850 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
                        <div>
                          <p className="text-sm font-semibold text-zinc-250">{cfg.label}</p>
                          {meta.query && (
                            <p className="text-xs text-zinc-500 mt-0.5">
                              Searched for: <span className="text-violet-400">"{meta.query}"</span>
                            </p>
                          )}
                          {meta.recipientName && (
                            <p className="text-xs text-zinc-500 mt-0.5">
                              To user: <span className="text-violet-400">@{meta.recipientName}</span>
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-zinc-650 flex items-center gap-1.5 flex-shrink-0 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          {formatTime(ev.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
