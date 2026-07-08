"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import LinkLegacy from "next/link";
import {
  Bell, CheckCheck, Trash2, X, Settings, Volume2, VolumeX,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import {
  markNotificationAsRead, markAllRead, deleteNotification, deleteAllNotifications, getNotifications,
} from "@/server/actions/notifications";
import { NOTIF_ICONS, NOTIF_COLORS, NOTIF_LABELS, NotificationRow } from "./NotificationBell";
import { playSound } from "@/lib/sounds";

let socket: Socket | null = null;



// ─── Toast Component ──────────────────────────────────────────────────────────
function Toast({ n, onDismiss }: { n: any; onDismiss: () => void }) {
  const Icon = NOTIF_ICONS[n.type] ?? Bell;
  const color = NOTIF_COLORS[n.type] ?? "bg-zinc-600";
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const sender = n.sender?.profile;
  return (
    <div className="fixed bottom-6 right-6 z-[9999] glass border border-zinc-700/80 rounded-2xl p-4 flex items-start gap-3 shadow-2xl w-80 animate-in slide-in-from-right-5 fade-in duration-300">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-100 truncate">
          {sender?.displayName ?? "TERA System"}
        </p>
        <p className="text-xs text-zinc-400 mt-0.5 truncate">{NOTIF_LABELS[n.type] ?? "Interacted with you"}</p>
      </div>
      <button onClick={onDismiss} className="text-zinc-500 hover:text-zinc-300 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Filters map ──────────────────────────────────────────────────────────────
type FilterType = "all" | "unread" | "social" | "messages" | "system";

const FILTER_GROUPS: Record<FilterType, string[]> = {
  all: [],
  unread: [],
  social: ["FOLLOW", "REACTION", "COMMENT", "REPLY", "MENTION", "TAG", "SHARE", "SAVE", "REPOST"],
  messages: ["MESSAGE", "GROUP_INVITE"],
  system: ["STORY_VIEW", "STORY_REACTION", "STORY_REPLY", "STORY_MENTION", "EVENT_INVITE", "POST_APPROVED", "POST_REMOVED", "ACCOUNT_VERIFIED", "SECURITY_ALERT", "LOGIN_ALERT", "SYSTEM", "ACHIEVEMENT", "ADMIN"],
};

export default function NotificationsClient({
  initialNotifications, currentUserId,
}: {
  initialNotifications: any[];
  currentUserId: string;
}) {
  const [notifs, setNotifs] = useState<any[]>(initialNotifications);
  const [cursor, setCursor] = useState<string | null>(
    initialNotifications.length > 0 ? initialNotifications[initialNotifications.length - 1].createdAt : null
  );
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [toast, setToast] = useState<any | null>(null);
  const [muted, setMuted] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("tera_notif_muted");
    if (saved === "true") setMuted(true);
  }, []);

  const toggleMute = () => {
    setMuted(prev => {
      const next = !prev;
      localStorage.setItem("tera_notif_muted", String(next));
      return next;
    });
  };

  const loaderRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef(new Set<string>(initialNotifications.map(n => n.id)));

  // Load more function for infinite scroll
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    try {
      const res = await getNotifications(filter === "unread" ? "unread" : "all", 20, cursor);
      if (res.notifications.length === 0) {
        setHasMore(false);
      } else {
        const filteredNew = res.notifications.filter(n => !seenIds.current.has(n.id));
        filteredNew.forEach(n => seenIds.current.add(n.id));
        setNotifs((prev) => [...prev, ...filteredNew]);
        setCursor(res.nextCursor);
        if (!res.nextCursor) setHasMore(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, hasMore, loadingMore, filter]);

  // Setup infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    const curr = loaderRef.current;
    if (curr) observer.observe(curr);
    return () => {
      if (curr) observer.unobserve(curr);
    };
  }, [loadMore]);

  // Handle live incoming notifications and cross-tab actions
  useEffect(() => {
    if (!socket) {
      socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000", {
        query: { userId: currentUserId },
      });
    }

    socket.on("notification:new", (n: any) => {
      if (seenIds.current.has(n.id)) return;
      seenIds.current.add(n.id);
      setNotifs((prev) => [n, ...prev]);
      setToast(n);
      if (!muted) playSound("notification");
    });

    socket.on("notification:read", ({ id }: { id: string }) => {
      setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    });

    socket.on("notification:read_all", () => {
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    });

    return () => {
      socket?.off("notification:new");
      socket?.off("notification:read");
      socket?.off("notification:read_all");
    };
  }, [currentUserId, muted]);

  const handleRead = useCallback(async (id: string) => {
    // Optimistic Update
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    await markNotificationAsRead(id);
    socket?.emit("notification:read", { id, userId: currentUserId });
  }, [currentUserId]);

  const handleDelete = useCallback(async (id: string) => {
    // Optimistic Update
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    await deleteNotification(id);
  }, []);

  const handleMarkAllRead = async () => {
    // Optimistic Update
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await markAllRead();
    socket?.emit("notification:read_all", { userId: currentUserId });
  };

  const handleDeleteAll = async () => {
    // Optimistic Update
    setNotifs([]);
    await deleteAllNotifications();
  };

  // Filter current loaded notifications locally
  const filtered = notifs.filter((n) => {
    if (filter === "unread") return !n.isRead;
    const group = FILTER_GROUPS[filter];
    if (group.length === 0) return true;
    return group.includes(n.type);
  });

  const unreadCount = notifs.filter((n) => !n.isRead).length;

  const TABS: { id: FilterType; label: string }[] = [
    { id: "all", label: "All" },
    { id: "unread", label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}` },
    { id: "social", label: "Social" },
    { id: "messages", label: "Messages" },
    { id: "system", label: "System" },
  ];

  return (
    <div className="py-6 px-4 md:px-6">
      {/* Top Banner Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-violet-500" />
            Notifications Center
          </h1>
          <p className="text-zinc-500 text-xs mt-1">Manage and respond to real-time events on your profile.</p>
        </div>
        
        {/* Buttons / Controls */}
        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={toggleMute}
            className={`p-2 rounded-xl border transition-all duration-200 flex items-center gap-1.5 text-xs font-semibold
              ${muted ? "bg-rose-500/10 border-rose-500/20 text-rose-400" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"}`}
            title={muted ? "Unmute Sounds" : "Mute Sounds"}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{muted ? "Silent" : "Sounds On"}</span>
          </button>

          {/* Mark All Read */}
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="p-2 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 hover:text-white border border-zinc-800 text-xs font-semibold text-zinc-300 flex items-center gap-1.5 transition-all"
            >
              <CheckCheck className="w-4 h-4 text-violet-400" />
              Mark all read
            </button>
          )}

          {/* Settings Shortcut */}
          <LinkLegacy
            href="/settings"
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs font-semibold text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 transition-all"
          >
            <Settings className="w-4 h-4" />
          </LinkLegacy>

          {/* Absolute Clear */}
          {notifs.length > 0 && (
            <button
              onClick={handleDeleteAll}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-rose-500/10 border border-rose-500/10 text-xs font-semibold text-zinc-500 hover:text-rose-400 flex items-center gap-1.5 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 mb-5 bg-zinc-900/60 border border-zinc-850 p-1 rounded-2xl max-w-lg scrollbar-hide">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`flex-1 min-w-[70px] py-2 rounded-xl text-xs font-semibold transition-all duration-200
              ${filter === t.id ? "gradient-btn text-white shadow-md font-bold" : "text-zinc-500 hover:text-zinc-350"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Main Panel Content */}
      <div className="border border-zinc-800/80 rounded-2xl overflow-hidden bg-zinc-900/10">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-zinc-500 gap-4">
            <div className="w-16 h-16 rounded-full bg-zinc-900/80 flex items-center justify-center border border-zinc-800">
              <Bell className="w-7 h-7 text-zinc-650 opacity-40 animate-pulse" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-zinc-300">
                {filter === "unread" ? "You're all caught up!" : "No notifications here yet"}
              </p>
              <p className="text-xs text-zinc-500 mt-1 max-w-[270px] mx-auto leading-relaxed">
                {filter === "unread"
                  ? "Zero unread alerts currently. Check back later!"
                  : "We'll ping you here when followed, mentioned, commented, or updated."}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-850/60 max-w-full">
            {filtered.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                onRead={handleRead}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Loader Trigger Element for Infinite scroll */}
      {hasMore && cursor && (
        <div ref={loaderRef} className="flex justify-center py-6">
          <div className="w-5 h-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        </div>
      )}

      {/* Floating real-time alert */}
      {toast && <Toast n={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
