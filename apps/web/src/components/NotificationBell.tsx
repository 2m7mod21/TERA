"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { io, Socket } from "socket.io-client";
import {
  Bell, Heart, MessageCircle, UserPlus, Star,
  CheckCheck, X, Check, AtSign, Reply, Film,
  Shield, Share2, Bookmark, Crown, Zap, Info,
} from "lucide-react";
import {
  markNotificationAsRead, markAllRead, deleteNotification, getNotifications,
} from "@/server/actions/notifications";
import { playSound } from "@/lib/sounds";
import { usePushNotifications } from "@/hooks/usePushNotifications";

let socket: Socket | null = null;


// ─── Config ───────────────────────────────────────────────────────────────────
export const NOTIF_ICONS: Record<string, React.ElementType> = {
  FOLLOW: UserPlus,
  FRIEND_REQUEST: UserPlus,
  FRIEND_ACCEPT: UserPlus,
  REACTION: Heart,
  COMMENT: MessageCircle,
  REPLY: Reply,
  MENTION: AtSign,
  TAG: AtSign,
  SHARE: Share2,
  SAVE: Bookmark,
  REPOST: Share2,
  MESSAGE: MessageCircle,
  MESSAGE_REACTION: Heart,
  STORY_VIEW: Film,
  STORY_REACTION: Heart,
  STORY_REPLY: Reply,
  STORY_MENTION: AtSign,
  GROUP_INVITE: UserPlus,
  EVENT_INVITE: Star,
  POST_APPROVED: Check,
  POST_REMOVED: X,
  ACCOUNT_VERIFIED: Crown,
  SECURITY_ALERT: Shield,
  LOGIN_ALERT: Shield,
  SYSTEM: Info,
  ACHIEVEMENT: Zap,
  ADMIN: Shield,
};

export const NOTIF_COLORS: Record<string, string> = {
  FOLLOW: "bg-violet-500",
  FRIEND_REQUEST: "bg-violet-600",
  FRIEND_ACCEPT: "bg-violet-400",
  REACTION: "bg-rose-500",
  COMMENT: "bg-blue-500",
  REPLY: "bg-blue-400",
  MENTION: "bg-amber-500",
  TAG: "bg-amber-400",
  SHARE: "bg-emerald-500",
  SAVE: "bg-pink-500",
  REPOST: "bg-emerald-400",
  MESSAGE: "bg-green-500",
  MESSAGE_REACTION: "bg-rose-400",
  STORY_VIEW: "bg-pink-500",
  STORY_REACTION: "bg-rose-400",
  STORY_REPLY: "bg-blue-400",
  STORY_MENTION: "bg-amber-400",
  GROUP_INVITE: "bg-violet-600",
  EVENT_INVITE: "bg-amber-500",
  POST_APPROVED: "bg-emerald-500",
  POST_REMOVED: "bg-red-500",
  ACCOUNT_VERIFIED: "bg-amber-400",
  SECURITY_ALERT: "bg-red-600",
  LOGIN_ALERT: "bg-red-500",
  SYSTEM: "bg-zinc-500",
  ACHIEVEMENT: "bg-amber-500",
  ADMIN: "bg-red-600",
};

export const ENTITY_LINKS: Record<string, (id: string) => string> = {
  POST: (id) => `/post/${id}`,
  COMMENT: (id) => `/post/${id}`,
  USER: (id) => `/${id}`,
  STORY: () => "/",
  GROUP: (id) => `/groups/${id}`,
  MESSAGE: (_id) => `/messages`,
};

// Static fallback labels used by NotificationsClient toast
export const NOTIF_LABELS: Record<string, string> = {
  FOLLOW: "started following you",
  FRIEND_REQUEST: "sent you a friend request",
  FRIEND_ACCEPT: "accepted your friend request",
  REACTION: "liked your post",
  COMMENT: "commented on your post",
  REPLY: "replied to your comment",
  MENTION: "mentioned you",
  TAG: "tagged you in a post",
  SHARE: "shared your post",
  SAVE: "saved your post",
  REPOST: "reposted your post",
  MESSAGE: "sent you a message",
  MESSAGE_REACTION: "reacted to your message",
  STORY_VIEW: "viewed your story",
  STORY_REACTION: "reacted to your story",
  STORY_REPLY: "replied to your story",
  STORY_MENTION: "mentioned you in a story",
  GROUP_INVITE: "invited you to a group",
  EVENT_INVITE: "invited you to an event",
  POST_APPROVED: "your post was approved",
  POST_REMOVED: "your post was removed",
  ACCOUNT_VERIFIED: "your account is verified",
  SECURITY_ALERT: "security alert on your account",
  LOGIN_ALERT: "new login detected",
  SYSTEM: "system notification",
  ACHIEVEMENT: "you earned an achievement",
  ADMIN: "admin notification",
};

export function timeAgo(date: Date | string) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(date).toLocaleDateString();
}

// ─── Skeleton item ────────────────────────────────────────────────────────────
function SkeletonNotif() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-zinc-800 flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-zinc-800 rounded-full w-3/4" />
        <div className="h-2.5 bg-zinc-800/70 rounded-full w-1/2" />
      </div>
    </div>
  );
}

// ─── Single notification row ──────────────────────────────────────────────────
export function NotificationRow({
  n, onRead, onDelete, compact = false,
}: {
  n: any; onRead: (id: string) => void; onDelete?: (id: string) => void; compact?: boolean;
}) {
  const tN = useTranslations("notifications");
  const Icon = NOTIF_ICONS[n.type] ?? Bell;
  const iconBg = NOTIF_COLORS[n.type] ?? "bg-zinc-500";
  const sender = n.sender?.profile;
  let entityLink = n.entityType && n.entityId
    ? (ENTITY_LINKS[n.entityType]?.(n.entityId) ?? "#")
    : "#";

  let meta: any = {};
  if (n.metadata) {
    try {
      meta = typeof n.metadata === "string" ? JSON.parse(n.metadata) : n.metadata;
    } catch { }
  }

  const commentId = meta.commentId || (n.entityType === "COMMENT" ? n.entityId : null);
  const postId = meta.postId || meta.relatedPostId || (n.entityType === "POST" ? n.entityId : null);

  if (commentId && postId) {
    entityLink = `/post/${postId}?comments=${postId}&highlightComment=${commentId}`;
  } else if (n.entityType === "COMMENT_POST" || n.entityType === "COMMENT") {
    if (postId) {
      entityLink = `/post/${postId}?comments=${postId}`;
    } else {
      entityLink = "/";
    }
  }

  // Build translated action label
  const NOTIF_KNOWN_TYPES = ["FOLLOW","FRIEND_REQUEST","FRIEND_ACCEPT","REACTION","COMMENT","REPLY","MENTION","TAG","SHARE","SAVE","REPOST","MESSAGE","MESSAGE_REACTION","STORY_VIEW","STORY_REACTION","STORY_REPLY","STORY_MENTION","GROUP_INVITE","EVENT_INVITE","POST_APPROVED","POST_REMOVED","ACCOUNT_VERIFIED","SECURITY_ALERT","LOGIN_ALERT","SYSTEM","ACHIEVEMENT","ADMIN"] as const;
  const labelKey = NOTIF_KNOWN_TYPES.includes(n.type) ? `labels.${n.type}` : "labels.SYSTEM";
  let actionLabel: string = tN(labelKey as any);
  let contentPreview = "";

  if (n.type === "REACTION" && meta.reactionType) {
    const KNOWN_REACTIONS = ["HEART","LAUGH","WOW","SAD","ANGRY"] as const;
    const rxIcon = KNOWN_REACTIONS.includes(meta.reactionType)
      ? tN(`reaction.${meta.reactionType}` as any)
      : "👍";
    actionLabel = tN("reactionLabel", { emoji: rxIcon });
  } else if (n.type === "COMMENT" && meta.commentText) {
    actionLabel = tN("labels.COMMENT");
    contentPreview = meta.commentText;
  } else if (n.type === "REPLY" && meta.commentText) {
    actionLabel = tN("labels.REPLY");
    contentPreview = meta.commentText;
  }

  const router = useRouter();
  const handleClick = () => {
    if (!n.isRead) onRead(n.id);
    if (entityLink && entityLink !== "#") {
      router.push(entityLink);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`group flex items-start gap-3 px-4 rounded-xl cursor-pointer transition-all duration-200
        hover:bg-zinc-800/60 relative
        ${!n.isRead ? "bg-violet-500/5" : ""}
        ${compact ? "py-2.5" : "py-3.5"}
      `}
    >
      {/* Unread indicator line */}
      {!n.isRead && (
        <div className="absolute inset-inline-start-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-violet-500 rounded-full" />
      )}

      {/* Avatar + icon badge */}
      <div className="relative flex-shrink-0">
        <div className={`rounded-full bg-gradient-to-br from-violet-500 to-pink-500 overflow-hidden border-2 border-zinc-900 ${compact ? "w-9 h-9" : "w-11 h-11"}`}>
          {sender?.avatarUrl
            ? <img src={sender.avatarUrl} className="w-full h-full object-cover" alt="" />
            : <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                {sender?.displayName?.[0] ?? "N"}
              </div>}
        </div>
        <div className={`absolute -bottom-1 -end-1 rounded-full flex items-center justify-center border-2 border-zinc-950 ${iconBg} ${compact ? "w-4 h-4" : "w-5 h-5"}`}>
          <Icon className={compact ? "w-2 h-2 text-white" : "w-2.5 h-2.5 text-white"} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-zinc-200 leading-snug ${compact ? "text-xs" : "text-sm"}`}>
          {sender
            ? <Link href={`/${sender.username}`} onClick={(e) => e.stopPropagation()}
                className="font-semibold hover:text-violet-400 transition-colors me-1">
                {sender.displayName}
              </Link>
            : <span className="font-semibold me-1">TERA</span>}
          <span className="text-zinc-400">{actionLabel}</span>
        </p>
        
        {contentPreview && (
          <p className="mt-1 text-xs text-zinc-350 italic truncate border-s-2 border-zinc-700 ps-2">
            {contentPreview}
          </p>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <p suppressHydrationWarning className={`text-zinc-650 ${compact ? "text-[10px]" : "text-xs"}`}>
            {timeAgo(n.createdAt)}
          </p>
          {entityLink !== "#" && (
            <Link href={entityLink} onClick={(e) => e.stopPropagation()}
              className={`text-violet-400 hover:text-violet-300 transition-colors ${compact ? "text-[10px]" : "text-xs"}`}>
              {tN("view")}
            </Link>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {!n.isRead && (
          <button onClick={(e) => { e.stopPropagation(); onRead(n.id); }}
            title={tN("markRead")}
            className="w-6 h-6 bg-zinc-800 hover:bg-violet-500/20 rounded-full flex items-center justify-center transition-colors">
            <Check className="w-3 h-3 text-zinc-400 hover:text-violet-400" />
          </button>
        )}
        {onDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(n.id); }}
            title={tN("delete")}
            className="w-6 h-6 bg-zinc-800 hover:bg-rose-500/20 rounded-full flex items-center justify-center transition-colors">
            <X className="w-3 h-3 text-zinc-500 hover:text-rose-400" />
          </button>
        )}
      </div>

      {/* Unread dot */}
      {!n.isRead && <div className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0 mt-1.5" />}
    </div>
  );
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────
interface NotificationBellProps {
  currentUserId: string;
  initialCount?: number;
}

export default function NotificationBell({ currentUserId, initialCount = 0 }: NotificationBellProps) {
  const tN = useTranslations("notifications");
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef(new Set<string>());
  const [badgeAnimate, setBadgeAnimate] = useState(false);

  // Register service worker + subscribe to push notifications
  usePushNotifications({ userId: currentUserId });

  // Load notifications when dropdown opens
  const loadNotifs = useCallback(async () => {
    setLoading(true);
    try {
      const { notifications } = await getNotifications("all", 15);
      setNotifs(notifications as any[]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Socket setup
  useEffect(() => {
    if (!socket) {
      socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000", {
        query: { userId: currentUserId },
      });
    }

    socket.on("notification:new", (n: any) => {
      if (seenIds.current.has(n.id)) return;
      seenIds.current.add(n.id);
      setNotifs((prev) => [n, ...prev.slice(0, 14)]);
      setUnreadCount((c) => c + 1);
      setBadgeAnimate(true);
      setTimeout(() => setBadgeAnimate(false), 600);
      if (!muted) playSound("notification");
    });

    socket.on("notification:read", ({ id }: { id: string }) => {
      setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    });

    socket.on("notification:read_all", () => {
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    });

    return () => {
      socket?.off("notification:new");
      socket?.off("notification:read");
      socket?.off("notification:read_all");
    };
  }, [currentUserId, muted]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    if (!open) loadNotifs();
    setOpen(!open);
  };

  const handleRead = useCallback(async (id: string) => {
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
    await markNotificationAsRead(id);
    socket?.emit("notification:read", { id, userId: currentUserId });
  }, [currentUserId]);

  const handleDelete = useCallback(async (id: string) => {
    const wasUnread = notifs.find((n) => n.id === id)?.isRead === false;
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    await deleteNotification(id);
  }, [notifs]);

  const handleMarkAllRead = async () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    await markAllRead();
    socket?.emit("notification:read_all", { userId: currentUserId });
  };

  const displayCount = unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <div className="relative" ref={dropRef}>
      {/* Bell button */}
      <button
        id="notif-bell-btn"
        onClick={handleOpen}
        className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200
          ${open ? "bg-violet-600/20 text-violet-400" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"}`}
      >
        <Bell className={`w-4 h-4 transition-transform ${open ? "rotate-12" : ""}`} />
        {displayCount && (
          <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-violet-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none border border-zinc-950
            ${badgeAnimate ? "scale-125" : "scale-100"} transition-transform duration-200`}>
            {displayCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute end-0 top-full mt-2 w-[380px] max-h-[520px] flex flex-col glass border border-zinc-700/50 rounded-2xl shadow-2xl overflow-hidden z-50 scale-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-zinc-100 text-base">{tN("title")}</h3>
              {displayCount && (
                <span className="bg-violet-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {tN("new", { count: unreadCount })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors px-2 py-1 rounded-lg hover:bg-violet-500/10">
                  <CheckCheck className="w-3.5 h-3.5" /> {tN("markReadShort")}
                </button>
              )}
              <button onClick={() => setMuted(!muted)}
                className={`text-xs px-2 py-1 rounded-lg transition-colors ${muted ? "text-rose-400 hover:text-rose-300 hover:bg-rose-500/10" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"}`}
                title={muted ? tN("unmute") : tN("mute")}>
                {muted ? "🔇" : "🔔"}
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1 py-1">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonNotif key={i} />)
            ) : notifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-600 gap-3">
                <div className="w-14 h-14 rounded-full bg-zinc-900 flex items-center justify-center">
                  <Bell className="w-7 h-7 opacity-30" />
                </div>
                <p className="text-sm font-medium">{tN("empty.title")}</p>
                <p className="text-xs text-center text-zinc-700 max-w-[200px]">
                  {tN("empty.subtitle")}
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {notifs.map((n) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    onRead={handleRead}
                    onDelete={handleDelete}
                    compact
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-zinc-800/60 px-4 py-2.5">
            <Link href="/notifications" onClick={() => setOpen(false)}
              className="block text-center text-sm text-violet-400 font-semibold hover:text-violet-300 transition-colors py-1 rounded-xl hover:bg-violet-500/10">
              {tN("seeAll")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
