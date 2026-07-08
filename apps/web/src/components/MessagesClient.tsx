"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessageCircle, Search, Plus, Archive, BellOff, Pin, LogOut, MoreHorizontal,
  Users, Check, Edit3, Send, Phone, Video, X, Edit2, Trash2, Reply,
  Smile, Image as ImageIcon, Mic, Paperclip, CheckCheck, ArrowLeft, Clock,
  Shield, UserPlus, UserCheck, UserX, Link2, Copy, Lock, Crown, Settings,
} from "lucide-react";
import {
  updateConversationSettings, leaveGroupConversation, createGroupConversation,
  saveMessage, editMessage, deleteMessage, reactToMessage, markAsRead,
  getChatMessagesClient, markAsDelivered,
  getConversationParticipants, addGroupMembers, promoteGroupMember,
  demoteGroupMember, removeGroupMember, updateGroupSettings,
} from "@/server/actions/messaging";
import { getFriendsList } from "@/server/actions/social";
import { io, Socket } from "socket.io-client";

// ─── Last-seen formatter ───────────────────────────────────────────────────────
function formatLastSeen(ts: string | Date | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "Last seen just now";
  if (diffMin < 60) return `Last seen ${diffMin} minute${diffMin > 1 ? "s" : ""} ago`;
  if (diffHours < 24) {
    const t = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `Last seen today at ${t}`;
  }
  if (diffDays === 1) {
    const t = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `Last seen yesterday at ${t}`;
  }
  if (diffDays < 7) {
    const day = d.toLocaleDateString("en-US", { weekday: "long" });
    return `Last seen on ${day}`;
  }
  return `Last seen ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}


let socket: Socket | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(date: Date | string) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function timeStr(date: string | Date) {
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function groupByDate(messages: any[]) {
  const groups: { label: string; messages: any[] }[] = [];
  for (const msg of messages) {
    const d = new Date(msg.createdAt);
    const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.messages.push(msg);
    else groups.push({ label, messages: [msg] });
  }
  return groups;
}

const QUICK_EMOJIS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

// ─── Emoji Picker ─────────────────────────────────────────────────────────────
function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  return (
    <div className="absolute bottom-8 right-0 z-50 glass border border-zinc-700 rounded-2xl p-2 flex gap-1 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150">
      {QUICK_EMOJIS.map((e) => (
        <button key={e} onClick={() => { onPick(e); onClose(); }}
          className="text-lg hover:scale-125 transition-transform p-1">{e}</button>
      ))}
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({
  msg, isOwn, currentUserId, onReply, onEdit, onDelete, onReact,
}: {
  msg: any; isOwn: boolean; currentUserId: string;
  onReply: (m: any) => void; onEdit: (m: any) => void;
  onDelete: (id: string) => void; onReact: (id: string, emoji: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const reactions: Array<{ userId: string; emoji: string }> = (() => {
    try { return JSON.parse(msg.reactions || "[]"); } catch { return []; }
  })();

  const grouped: Record<string, { count: number; mine: boolean }> = {};
  for (const r of reactions) {
    const slot = grouped[r.emoji];
    if (!slot) grouped[r.emoji] = { count: 1, mine: r.userId === currentUserId };
    else { slot.count++; if (r.userId === currentUserId) slot.mine = true; }
  }

  const readBy: string[] = (() => { try { return JSON.parse(msg.readBy || "[]"); } catch { return []; } })();
  const deliveredTo: string[] = (() => { try { return JSON.parse((msg as any).deliveredTo || "[]"); } catch { return []; } })();
  const isRead = readBy.some((id) => id !== currentUserId);
  const isDelivered = deliveredTo.some((id) => id !== currentUserId);
  const isSending = msg.id?.startsWith("opt-");

  // Determine tick state
  const tickEl = (() => {
    if (!isOwn) return null;
    if (isSending) return <span className="w-3 h-3 rounded-full border border-zinc-500 border-t-transparent animate-spin" />;
    if (isRead) return <CheckCheck className="w-3 h-3 text-blue-400" />;
    if (isDelivered) return <CheckCheck className="w-3 h-3 text-zinc-500" />;
    return <Check className="w-3 h-3 text-zinc-500" />;
  })();

  if (msg.deletedForAll) {
    return (
      <div className={`flex items-end gap-2 ${isOwn ? "flex-row-reverse" : ""}`}>
        <div className="w-7 h-7 rounded-full bg-zinc-800 flex-shrink-0" />
        <div className="px-4 py-2.5 bg-zinc-800/50 rounded-2xl text-xs text-zinc-500 italic">
          This message was deleted
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-2 group ${isOwn ? "flex-row-reverse" : ""}`}>
      {!isOwn && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 overflow-hidden flex-shrink-0">
          {msg.sender?.profile?.avatarUrl
            ? <img src={msg.sender.profile.avatarUrl} className="w-full h-full object-cover" alt="" />
            : <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                {msg.sender?.profile?.displayName?.[0] ?? "?"}
              </div>}
        </div>
      )}

      <div className="relative max-w-[72%]">
        {msg.replyToId && msg.replyTo && (
          <div className="mb-1 px-3 py-1.5 rounded-xl border-l-2 border-violet-500 bg-zinc-800/60 text-xs text-zinc-400 truncate">
            ↩ {msg.replyTo.content ?? "Media"}
          </div>
        )}

        <div className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isOwn ? "gradient-btn text-white rounded-br-sm" : "bg-zinc-800 text-zinc-100 rounded-bl-sm"
        }`}>
          {msg.mediaUrl && (
            <div className="mb-2">
              {msg.mediaType === "IMAGE"
                ? <img src={msg.mediaUrl} className="rounded-xl max-w-full max-h-48 object-cover" alt="" />
                : msg.mediaType === "VIDEO"
                ? <video src={msg.mediaUrl} className="rounded-xl max-w-full max-h-48" controls />
                : <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-violet-300 underline flex items-center gap-1">
                    <Paperclip className="w-3 h-3" />Attachment
                  </a>}
            </div>
          )}

          {msg.content && <span>{msg.content}</span>}
          {msg.isEdited && <span className="text-[10px] opacity-50 ml-1">(edited)</span>}

          <div className={`absolute top-1/2 -translate-y-1/2 ${isOwn ? "right-full mr-2" : "left-full ml-2"} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1`}>
            <button onClick={() => onReply(msg)} title="Reply"
              className="w-7 h-7 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center transition-colors">
              <Reply className="w-3.5 h-3.5 text-zinc-400" />
            </button>
            <div className="relative">
              <button onClick={() => setEmojiOpen((o) => !o)} title="React"
                className="w-7 h-7 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center transition-colors">
                <Smile className="w-3.5 h-3.5 text-zinc-400" />
              </button>
              {emojiOpen && <EmojiPicker onPick={(e) => onReact(msg.id, e)} onClose={() => setEmojiOpen(false)} />}
            </div>
            {isOwn && (
              <div className="relative">
                <button onClick={() => setMenuOpen((o) => !o)} title="More"
                  className="w-7 h-7 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center transition-colors">
                  <MoreHorizontal className="w-3.5 h-3.5 text-zinc-400" />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <div className="absolute bottom-9 right-0 z-50 glass border border-zinc-800 rounded-2xl py-1 w-36 shadow-xl">
                      {msg.content && (
                        <button onClick={() => { onEdit(msg); setMenuOpen(false); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-zinc-700/50 transition-colors">
                          <Edit2 className="w-3 h-3 text-zinc-400" />Edit
                        </button>
                      )}
                      <button onClick={() => { onDelete(msg.id); setMenuOpen(false); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-red-500/10 text-rose-400 transition-colors">
                        <Trash2 className="w-3 h-3" />Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {Object.keys(grouped).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
            {Object.entries(grouped).map(([emoji, { count, mine }]) => (
              <button key={emoji} onClick={() => onReact(msg.id, emoji)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-all ${mine ? "border-violet-500 bg-violet-500/20 text-violet-300" : "border-zinc-700 bg-zinc-800 text-zinc-400"}`}>
                {emoji} {count}
              </button>
            ))}
          </div>
        )}

        <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? "justify-end" : "justify-start"}`}>
          <span className="text-[10px] text-zinc-600">{timeStr(msg.createdAt)}</span>
          {tickEl}
        </div>
      </div>
    </div>
  );
}

// ─── Chat Panel ────────────────────────────────────────────────────────────────
function ChatPanel({
  conversation, currentUserId, currentUser, onClose,
}: {
  conversation: any;
  currentUserId: string;
  currentUser: any;
  onClose: () => void;
}) {
  const conversationId = conversation.id;
  const isGroup = !!conversation.isGroup;
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [editingMsg, setEditingMsg] = useState<any | null>(null);
  const [editInput, setEditInput] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherLastSeen, setOtherLastSeen] = useState<string | null>(null);
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);

  // Derive whether current user is admin of this group
  const selfParticipant = conversation?.participants?.find((p: any) => p.userId === currentUserId);
  const isAdmin = isGroup && selfParticipant?.role === "ADMIN";

  // Parse group description settings
  const groupSettings = (() => {
    try { return JSON.parse(conversation?.description || "{}"); } catch { return {}; }
  })();
  const adminsOnly: boolean = !!groupSettings?.adminsOnly;

  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmit = useRef<number>(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const otherUser = conversation?.otherUser;

  // Load messages when conversation changes
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    getChatMessagesClient(conversationId).then((msgs: any[]) => {
      setMessages(msgs);
      setLoading(false);
    });
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark received messages as delivered + read when chat is open
  useEffect(() => {
    if (messages.length === 0) return;
    const notDelivered = messages
      .filter((m) => m.senderId !== currentUserId && !m.id?.startsWith("opt-"))
      .filter((m) => { try { const d: string[] = JSON.parse((m as any).deliveredTo || "[]"); return !d.includes(currentUserId); } catch { return true; } })
      .map((m) => m.id);

    const unread = messages
      .filter((m) => m.senderId !== currentUserId && !m.id?.startsWith("opt-"))
      .filter((m) => { try { const r: string[] = JSON.parse(m.readBy || "[]"); return !r.includes(currentUserId); } catch { return true; } })
      .map((m) => m.id);

    if (notDelivered.length > 0 || unread.length > 0) {
      if (notDelivered.length > 0) {
        markAsDelivered(notDelivered);
        socket?.emit("message:delivered", { conversationId, messageIds: notDelivered, userId: currentUserId });
      }
      if (unread.length > 0) {
        markAsRead(unread);
        socket?.emit("message:read", { conversationId, userId: currentUserId, messageIds: unread, lastReadAt: new Date().toISOString() });
      }

      // Update local state in one batch to prevent infinite loops
      setMessages((prev) => prev.map((m) => {
        let updated = { ...m };
        let changed = false;
        if (notDelivered.includes(m.id)) {
          const d = (() => { try { return JSON.parse(m.deliveredTo || "[]"); } catch { return []; } })();
          if (!d.includes(currentUserId)) {
            d.push(currentUserId);
            updated.deliveredTo = JSON.stringify(d);
            changed = true;
          }
        }
        if (unread.includes(m.id)) {
          const r = (() => { try { return JSON.parse(m.readBy || "[]"); } catch { return []; } })();
          if (!r.includes(currentUserId)) {
            r.push(currentUserId);
            updated.readBy = JSON.stringify(r);
            changed = true;
          }
        }
        return changed ? updated : m;
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, conversationId, currentUserId]);

  // Socket.IO
  useEffect(() => {
    if (!socket) {
      socket = io("http://localhost:3000", { query: { userId: currentUserId } });
    }
    socket.emit("conversation:join", conversationId);

    // Request presence of other user
    const otherUserId = conversation?.otherUser?.id;
    if (otherUserId) {
      socket.emit("presence:get", { targetUserId: otherUserId, viewerId: currentUserId });
    }

    socket.on("presence:res", (data: any) => {
      if (data.userId === otherUserId) {
        setOtherOnline(data.online);
        setOtherLastSeen(data.lastSeenAt ?? null);
      }
    });
    socket.on("presence:online", ({ userId }: any) => {
      if (userId === otherUserId) { setOtherOnline(true); setOtherLastSeen(null); }
    });
    socket.on("presence:offline", ({ userId, lastSeenAt }: any) => {
      if (userId === otherUserId) { setOtherOnline(false); setOtherLastSeen(lastSeenAt); }
    });
    socket.on("message:receive", (msg: any) => {
      if (msg.conversationId === conversationId) {
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Ack delivery immediately
        socket?.emit("message:delivered", { conversationId, messageIds: [msg.id], userId: currentUserId });
      }
    });
    socket.on("message:edited", (msg: any) => {
      if (msg.conversationId === conversationId)
        setMessages((prev) => prev.map((m) => (m.id === msg.messageId ? { ...m, content: msg.content, isEdited: true } : m)));
    });
    socket.on("message:deleted", ({ messageId }: any) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, deletedForAll: true } : m)));
    });
    socket.on("message:delivered", ({ messageIds, userId: uid }: any) => {
      if (uid !== currentUserId)
        setMessages((prev) => prev.map((m) =>
          messageIds.includes(m.id)
            ? { ...m, deliveredTo: JSON.stringify([...((() => { try { return JSON.parse(m.deliveredTo || "[]"); } catch { return []; } })()), uid].filter((v, i, a) => a.indexOf(v) === i)) }
            : m
        ));
    });
    socket.on("message:read", ({ messageIds, userId: uid }: any) => {
      if (uid !== currentUserId)
        setMessages((prev) => prev.map((m) =>
          (messageIds ?? []).includes(m.id)
            ? { ...m, readBy: JSON.stringify([...((() => { try { return JSON.parse(m.readBy || "[]"); } catch { return []; } })()), uid].filter((v, i, a) => a.indexOf(v) === i)) }
            : m
        ));
    });
    socket.on("typing:start", (data: any) => {
      if (data.userId !== currentUserId && data.conversationId === conversationId) setTyping(true);
    });
    socket.on("typing:stop", (data: any) => {
      if (data.userId !== currentUserId) setTyping(false);
    });

    return () => {
      socket?.emit("conversation:leave", conversationId);
      socket?.off("presence:res"); socket?.off("presence:online"); socket?.off("presence:offline");
      socket?.off("message:receive"); socket?.off("message:edited"); socket?.off("message:deleted");
      socket?.off("message:delivered"); socket?.off("message:read");
      socket?.off("typing:start"); socket?.off("typing:stop");
    };
  }, [conversationId, currentUserId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const clearMedia = () => { setMediaFile(null); setMediaPreview(null); if (fileRef.current) fileRef.current.value = ""; };

  const handleSend = useCallback(async () => {
    if (!input.trim() && !mediaFile) return;
    setSending(true);
    let mediaUrl: string | undefined;
    let mediaType: string | undefined;

    try {
      if (mediaFile) {
        setUploading(true);
        const fd = new FormData();
        fd.append("file", mediaFile);
        const up = await fetch("/api/upload", { method: "POST", body: fd }).then((r) => r.json());
        if (up.success) {
          mediaUrl = up.url;
          mediaType = mediaFile.type.startsWith("video") ? "VIDEO" : "IMAGE";
        }
        setUploading(false);
      }

      const content = input.trim() || undefined;
      const optimistic = {
        id: `opt-${Date.now()}`,
        content: content ?? null,
        mediaUrl: mediaPreview ?? null,
        mediaType: mediaType ?? null,
        conversationId,
        senderId: currentUserId,
        readBy: "[]",
        reactions: "[]",
        replyToId: replyTo?.id ?? null,
        replyTo: replyTo ?? null,
        isEdited: false,
        deletedForAll: false,
        createdAt: new Date().toISOString(),
        sender: { profile: { displayName: currentUser.name, avatarUrl: currentUser.image, username: currentUser.username } },
      };

      setInput("");
      setReplyTo(null);
      clearMedia();
      setMessages((prev) => [...prev, optimistic]);

      const res = await saveMessage({ conversationId, content, mediaUrl, mediaType, replyToId: replyTo?.id });
      if (res.success && res.message) {
        setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? { ...optimistic, ...res.message } : m)));
        socket?.emit("message:send", res.message);
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      }
    } finally {
      setSending(false);
    }
  }, [input, mediaFile, mediaPreview, conversationId, currentUserId, currentUser, replyTo]);

  const handleInputChange = (val: string) => {
    setInput(val);
    // Throttled typing:start – emit at most once every 3 s
    const now = Date.now();
    if (now - lastTypingEmit.current > 3000) {
      socket?.emit("typing:start", { conversationId, userId: currentUserId, username: currentUser?.username });
      lastTypingEmit.current = now;
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket?.emit("typing:stop", { conversationId, userId: currentUserId });
      lastTypingEmit.current = 0;
    }, 3000);
  };

  const handleEdit = async () => {
    if (!editingMsg || !editInput.trim()) return;
    const res = await editMessage(editingMsg.id, editInput);
    if (res.success && res.message) {
      setMessages((prev) => prev.map((m) => (m.id === editingMsg.id ? { ...m, content: editInput, isEdited: true } : m)));
      socket?.emit("message:edit", res.message);
    }
    setEditingMsg(null);
    setEditInput("");
  };

  const handleDelete = async (id: string) => {
    const res = await deleteMessage(id);
    if (res.success) {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, deletedForAll: true } : m)));
      socket?.emit("message:delete", { id, conversationId });
    }
  };

  const handleReact = async (msgId: string, emoji: string) => {
    const res = await reactToMessage(msgId, emoji);
    if (res.success && res.message) {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, reactions: (res.message as any).reactions } : m)));
    }
  };

  const groupedMsgs = groupByDate(messages);

  // Build the header separately so it renders inside the chat column
  const chatHeader = (
    <header className="glass border-b border-zinc-800 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-800 transition-colors md:hidden">
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Avatar */}
        <div className="relative w-10 h-10 flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 overflow-hidden">
            {isGroup ? (
              conversation?.avatarUrl
                ? <img src={conversation.avatarUrl} className="w-full h-full object-cover" alt="" />
                : <div className="w-full h-full flex items-center justify-center"><Users className="w-5 h-5 text-white" /></div>
            ) : (
              otherUser?.profile?.avatarUrl
                ? <img src={otherUser.profile.avatarUrl} className="w-full h-full object-cover" alt="" />
                : <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                    {(otherUser?.profile?.displayName ?? "?")[0]}
                  </div>
            )}
          </div>
          {otherOnline && !isGroup && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-zinc-900 rounded-full" />
          )}
        </div>

        {/* Name / status — group name is clickable to open settings */}
        <div className="flex-1 min-w-0">
          {isGroup ? (
            <button
              onClick={() => setGroupSettingsOpen(true)}
              className="font-semibold text-zinc-100 hover:text-violet-400 transition-colors text-sm truncate block text-left w-full"
            >
              {conversation?.name ?? "Group"}
            </button>
          ) : (
            otherUser
              ? <Link href={`/${otherUser.profile?.username}`} className="font-semibold text-zinc-100 hover:text-violet-400 transition-colors text-sm truncate block">
                  {otherUser.profile?.displayName}
                </Link>
              : <span className="font-semibold text-sm truncate block">{conversation?.name}</span>
          )}
          {typing ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-violet-400">typing</span>
              <div className="flex gap-0.5 items-center">
                <span className="w-1 h-1 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1 h-1 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1 h-1 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          ) : isGroup ? (
            <p className="text-xs text-zinc-500">
              {conversation?.participants?.length ?? 0} members{adminsOnly ? " · 🔒 Admins only" : ""}
            </p>
          ) : otherOnline ? (
            <p className="text-xs text-emerald-400 font-medium">Online</p>
          ) : otherLastSeen ? (
            <p className="text-xs text-zinc-500 flex items-center gap-1"><Clock className="w-3 h-3" />{formatLastSeen(otherLastSeen)}</p>
          ) : null}
        </div>

        <div className="flex gap-1">
          {isGroup && (
            <button
              onClick={() => setGroupSettingsOpen(true)}
              className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-500 hover:text-violet-400 transition-all"
              title="Group settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
          <button className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-500 hover:text-violet-400 transition-all" title="Voice call">
            <Phone className="w-5 h-5" />
          </button>
          <button className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-500 hover:text-violet-400 transition-all" title="Video call">
            <Video className="w-5 h-5" />
          </button>
        </div>
      </header>
    );

  // ── compose the full panel (chat column + optional settings sidebar)
  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Main chat column */}
      <div className={`flex flex-col h-full transition-all duration-300 ${groupSettingsOpen ? "flex-1 min-w-0" : "flex-1"}`}>
        {chatHeader}

        {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-zinc-600">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Loading messages…</p>
          </div>
        ) : (
          <>
            {groupedMsgs.map(({ label, messages: dayMsgs }) => (
              <div key={label}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span className="text-xs text-zinc-500 font-medium px-2">{label}</span>
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>
                <div className="space-y-3">
                  {dayMsgs.map((msg) => (
                    <MessageBubble
                      key={msg.id} msg={msg} isOwn={msg.senderId === currentUserId}
                      currentUserId={currentUserId}
                      onReply={setReplyTo}
                      onEdit={(m) => { setEditingMsg(m); setEditInput(m.content ?? ""); }}
                      onDelete={handleDelete}
                      onReact={handleReact}
                    />
                  ))}
                </div>
              </div>
            ))}

            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-zinc-600 text-sm gap-2">
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                  <Send className="w-5 h-5 opacity-30" />
                </div>
                <p>No messages yet — say hello! 👋</p>
              </div>
            )}

            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Edit mode */}
      {editingMsg && (
        <div className="glass border-t border-zinc-800 px-4 py-2 flex items-center gap-3">
          <Edit2 className="w-4 h-4 text-violet-400 flex-shrink-0" />
          <input
            autoFocus value={editInput} onChange={(e) => setEditInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleEdit(); if (e.key === "Escape") { setEditingMsg(null); setEditInput(""); } }}
            className="flex-1 bg-transparent text-sm text-zinc-100 outline-none"
            placeholder="Edit message…"
          />
          <button onClick={handleEdit} className="gradient-btn text-white text-xs px-3 py-1.5 rounded-xl">Save</button>
          <button onClick={() => { setEditingMsg(null); setEditInput(""); }} className="text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Reply context */}
      {replyTo && !editingMsg && (
        <div className="glass border-t border-zinc-800 px-4 py-2 flex items-center gap-3">
          <Reply className="w-4 h-4 text-violet-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-violet-400 font-medium">Replying to {replyTo.sender?.profile?.displayName ?? "message"}</p>
            <p className="text-xs text-zinc-500 truncate">{replyTo.content ?? "Media"}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Media preview */}
      {mediaPreview && !editingMsg && (
        <div className="glass border-t border-zinc-800 px-4 py-2 flex items-center gap-3">
          <img src={mediaPreview} className="h-14 w-14 object-cover rounded-xl border border-zinc-700" alt="Preview" />
          <span className="text-xs text-zinc-400 flex-1 truncate">{mediaFile?.name}</span>
          <button onClick={clearMedia} className="text-zinc-500 hover:text-rose-400"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Input bar */}
      {!editingMsg && (
        <div className="glass border-t border-zinc-800 px-4 py-3 flex items-center gap-2 flex-shrink-0">
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
          <button onClick={() => fileRef.current?.click()} title="Attach media"
            className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-500 hover:text-violet-400 transition-all flex-shrink-0">
            <ImageIcon className="w-5 h-5" />
          </button>
          <button title="Voice message"
            className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-500 hover:text-violet-400 transition-all flex-shrink-0">
            <Mic className="w-5 h-5" />
          </button>
          <input
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Type a message…"
            className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-violet-500 rounded-xl px-4 py-2.5 text-sm text-zinc-100 outline-none transition-all"
          />
          <button
            onClick={handleSend}
            disabled={sending || uploading || (!input.trim() && !mediaFile)}
            className="gradient-btn p-2.5 rounded-xl text-white disabled:opacity-40 transition-all flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      )}
      </div>

      {groupSettingsOpen && isGroup && (
        <GroupSettingsSidebar
          conversationId={conversationId}
          conversationName={conversation?.name ?? "Group"}
          conversationAvatarUrl={conversation?.avatarUrl ?? null}
          conversationDescription={conversation?.description ?? ""}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          adminsOnly={adminsOnly}
          onUpdateSettings={(name, avatar, desc, _adminLock) => {
            if (conversation) {
              conversation.name = name;
              conversation.avatarUrl = avatar;
              conversation.description = desc;
            }
          }}
          onClose={() => setGroupSettingsOpen(false)}
          onLeave={() => { setGroupSettingsOpen(false); onClose(); }}
        />
      )}
    </div>
  );
}

// ─── Conversation Row Context Menu ────────────────────────────────────────────
function ConvMenu({
  conv, currentUserId, onUpdate,
}: {
  conv: any; currentUserId: string; onUpdate: (id: string, patch: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const participant = conv.participants?.find((p: any) => p.userId === currentUserId);
  const isPinned = participant?.isPinned ?? false;
  const isMuted = participant?.isMuted ?? false;
  const isArchived = participant?.isArchived ?? false;

  const act = async (settings: Record<string, boolean>) => {
    await updateConversationSettings(conv.id, settings);
    onUpdate(conv.id, settings);
    setOpen(false);
  };

  const handleLeave = async () => {
    await leaveGroupConversation(conv.id);
    router.refresh();
    setOpen(false);
  };

  return (
    <div className="relative" onClick={(e) => e.preventDefault()}>
      <button onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        className="p-1.5 opacity-0 group-hover:opacity-100 rounded-xl hover:bg-zinc-700 transition-all">
        <MoreHorizontal className="w-4 h-4 text-zinc-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 glass border border-zinc-800 rounded-2xl py-1 w-44 shadow-2xl">
            <button onClick={() => act({ isPinned: !isPinned })}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-zinc-700/50 transition-colors">
              <Pin className="w-3.5 h-3.5 text-zinc-400" />{isPinned ? "Unpin" : "Pin"} chat
            </button>
            <button onClick={() => act({ isMuted: !isMuted })}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-zinc-700/50 transition-colors">
              <BellOff className="w-3.5 h-3.5 text-zinc-400" />{isMuted ? "Unmute" : "Mute"} notifications
            </button>
            <button onClick={() => act({ isArchived: !isArchived })}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-zinc-700/50 transition-colors">
              <Archive className="w-3.5 h-3.5 text-zinc-400" />{isArchived ? "Unarchive" : "Archive"} chat
            </button>
            {conv.isGroup && (
              <>
                <div className="h-px bg-zinc-800 mx-3 my-1" />
                <button onClick={handleLeave}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors">
                  <LogOut className="w-3.5 h-3.5" />Leave group
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── New Group Modal ───────────────────────────────────────────────────────────
type FriendItem = {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
};

function NewGroupModal({ onClose, onCreated, currentUserId }: { onClose: () => void; onCreated: (conv: any) => void; currentUserId: string }) {
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [searchFriend, setSearchFriend] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch friends list on mount
  useEffect(() => {
    getFriendsList().then((res) => {
      setFriends(res);
      setLoadingFriends(false);
    });
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const data = new FormData();
      data.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: data,
      });
      const json = await res.json();
      if (json.success && json.url) {
        setAvatarUrl(json.url);
      } else {
        alert("Upload failed. Please try again.");
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading file.");
    } finally {
      setUploading(false);
    }
  };

  const toggleFriend = (id: string) => {
    setSelectedFriendIds((prev) =>
      prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
    );
  };

  const create = async () => {
    if (!name.trim() || selectedFriendIds.length === 0) return;
    setCreating(true);
    const res = await createGroupConversation(name.trim(), selectedFriendIds, avatarUrl || undefined);
    setCreating(false);
    if (res.success && res.conversation) {
      // Optimistically construct the participants list format
      const fullConv = {
        ...res.conversation,
        participants: [
          { userId: currentUserId, role: "ADMIN", user: { profile: {} } },
          ...selectedFriendIds.map((id) => {
            const friend = friends.find((f) => f.id === id);
            return {
              userId: id,
              role: "MEMBER",
              user: {
                id,
                profile: {
                  avatarUrl: friend?.avatarUrl || null,
                  displayName: friend?.displayName || "Member",
                  username: friend?.username || "member",
                },
              },
            };
          }),
        ],
        messages: [],
        lastMessage: null,
      };
      onCreated(fullConv);
      onClose();
    } else {
      alert(res.error || "Failed to create group.");
    }
  };

  const filteredFriends = friends.filter(
    (f) =>
      f.displayName.toLowerCase().includes(searchFriend.toLowerCase()) ||
      f.username.toLowerCase().includes(searchFriend.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="glass border border-zinc-800 rounded-3xl p-6 w-full max-w-md flex flex-col max-h-[85vh] shadow-[0_0_50px_rgba(139,92,246,0.15)] space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-400" /> New Group Chat
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 hover:bg-zinc-800 transition-colors rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-100 outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Controls */}
        <div className="flex items-center gap-4">
          {/* Avatar selector & Upload */}
          <div className="relative group flex-shrink-0 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700/80 overflow-hidden flex items-center justify-center relative shadow-inner">
              {avatarUrl ? (
                <img src={avatarUrl} className="w-full h-full object-cover" alt="Group avatar" />
              ) : (
                <ImageIcon className="w-6 h-6 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
              )}
              {uploading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="w-4 h-4 rounded-full border border-violet-400 border-t-transparent animate-spin" />
                </div>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarUpload}
              accept="image/*"
              className="hidden"
            />
          </div>

          <div className="flex-1">
            <label className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase block mb-1">
              Group Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dream Team 🚀"
              className="w-full bg-zinc-900/50 border border-zinc-800 focus:border-violet-500/80 rounded-2xl px-4 py-2.5 text-sm text-zinc-100 outline-none transition-all placeholder-zinc-600"
            />
          </div>
        </div>

        {/* Friend Selector Container */}
        <div className="flex-1 flex flex-col min-h-0 space-y-2.5">
          <label className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase block">
            Add members ({selectedFriendIds.length} selected)
          </label>

          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-650" />
            <input
              value={searchFriend}
              onChange={(e) => setSearchFriend(e.target.value)}
              placeholder="Search friends..."
              className="w-full bg-zinc-900/40 border border-zinc-850 rounded-2xl pl-10 pr-4 py-2 text-xs text-zinc-100 outline-none focus:border-violet-500/60 transition-all"
            />
          </div>

          {/* Friends List */}
          <div className="flex-1 overflow-y-auto min-h-48 max-h-60 rounded-2xl border border-zinc-900 bg-zinc-950/20 divide-y divide-zinc-900/60">
            {loadingFriends ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <span className="w-5 h-5 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
                <span className="text-xs text-zinc-500">Loading friends...</span>
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="text-center py-10 text-xs text-zinc-600">
                {friends.length === 0 ? "You don't follow anyone yet." : "No friends matches your search."}
              </div>
            ) : (
              filteredFriends.map((f) => {
                const isSelected = selectedFriendIds.includes(f.id);
                return (
                  <div
                    key={f.id}
                    onClick={() => toggleFriend(f.id)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-900/40 transition-colors cursor-pointer select-none"
                  >
                    <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0">
                      {f.avatarUrl ? (
                        <img src={f.avatarUrl} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-200 text-xs font-semibold">
                          {f.displayName[0]}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-200 truncate">{f.displayName}</p>
                      <p className="text-[10px] text-zinc-500 truncate">@{f.username}</p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                        isSelected
                          ? "bg-violet-500 border-violet-550 shadow-[0_0_8px_rgba(139,92,246,0.4)]"
                          : "border-zinc-805 hover:border-zinc-700 bg-zinc-900/60"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="pt-2 border-t border-zinc-805/80 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-zinc-905 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-250 py-2.5 rounded-2xl font-semibold text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={creating || !name.trim() || selectedFriendIds.length === 0}
            className="flex-1 gradient-btn text-white py-2.5 rounded-2xl font-semibold text-xs disabled:opacity-40 disabled:pointer-events-none transition-opacity"
          >
            {creating ? "Creating..." : "Create Group"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Group Settings Sidebar ───────────────────────────────────────────────────
type ParticipantItem = { userId: string; role: string; displayName: string; username: string; avatarUrl: string | null; };

function GroupSettingsSidebar({
  conversationId, conversationName, conversationAvatarUrl, conversationDescription, currentUserId,
  isAdmin, adminsOnly, onUpdateSettings, onClose, onLeave,
}: {
  conversationId: string;
  conversationName: string;
  conversationAvatarUrl: string | null;
  conversationDescription?: string;
  currentUserId: string;
  isAdmin: boolean;
  adminsOnly: boolean;
  onUpdateSettings?: (name: string, avatarUrl: string, description: string, adminsOnly: boolean) => void;
  onClose: () => void;
  onLeave: () => void;
}) {
  const router = useRouter();
  const [participants, setParticipants] = useState<ParticipantItem[]>([]);
  const [loadingP, setLoadingP] = useState(true);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [loadingF, setLoadingF] = useState(false);
  const [selectedNewIds, setSelectedNewIds] = useState<string[]>([]);
  const [searchP, setSearchP] = useState("");
  const [searchF, setSearchF] = useState("");
  const [groupName, setGroupName] = useState(conversationName);
  const [groupDesc, setGroupDesc] = useState(conversationDescription ?? "");
  const [isLocked, setIsLocked] = useState(adminsOnly);
  const [avatarUrl, setAvatarUrl] = useState(conversationAvatarUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Load participants
  useEffect(() => {
    getConversationParticipants(conversationId).then((res) => {
      setParticipants(res);
      setLoadingP(false);
    });
  }, [conversationId]);

  // Load friends for the inline add widget
  useEffect(() => {
    setLoadingF(true);
    getFriendsList().then((res) => {
      setFriends(res);
      setLoadingF(false);
    });
  }, [conversationId]);

  const existingIds = new Set(participants.map((p) => p.userId));
  const addableFriends = friends.filter((f) => !existingIds.has(f.id) && (
    f.displayName.toLowerCase().includes(searchF.toLowerCase()) ||
    f.username.toLowerCase().includes(searchF.toLowerCase())
  ));

  const refresh = () => {
    setLoadingP(true);
    getConversationParticipants(conversationId).then((res) => {
      setParticipants(res);
      setLoadingP(false);
    });
    router.refresh();
  };

  const flash = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 3500);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const json = await fetch("/api/upload", { method: "POST", body: fd }).then((r) => r.json());
      if (json.success && json.url) {
        setAvatarUrl(json.url);
        flash("Avatar uploaded, save settings to apply!");
      }
    } catch {
      flash("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveInfo = async () => {
    setSaving(true);
    try {
      await updateGroupSettings(conversationId, { name: groupName, avatarUrl, description: groupDesc, adminsOnly: isLocked });
      if (onUpdateSettings) {
        onUpdateSettings(groupName, avatarUrl, groupDesc, isLocked);
      }
      flash("Group settings updated!");
      router.refresh();
    } catch {
      flash("Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const handlePromote = async (userId: string) => {
    await promoteGroupMember(conversationId, userId);
    flash("Promoted to admin!");
    refresh();
  };

  const handleDemote = async (userId: string) => {
    await demoteGroupMember(conversationId, userId);
    flash("Demoted to member.");
    refresh();
  };

  const handleKick = async (userId: string) => {
    if (!confirm("Remove this member?")) return;
    await removeGroupMember(conversationId, userId);
    flash("Member removed.");
    refresh();
  };

  const handleTransfer = async (userId: string) => {
    if (!confirm("Transfer ownership? You will become a regular member.")) return;
    await promoteGroupMember(conversationId, userId);
    await demoteGroupMember(conversationId, currentUserId);
    flash("Ownership transferred.");
    refresh();
  };

  const handleAddMembers = async () => {
    if (selectedNewIds.length === 0) return;
    await addGroupMembers(conversationId, selectedNewIds);
    setSelectedNewIds([]);
    flash(`${selectedNewIds.length} member(s) added!`);
    refresh();
  };

  const handleLeave = async () => {
    if (!confirm("Leave this group?")) return;
    await leaveGroupConversation(conversationId);
    onLeave();
  };

  const handleCopyInvite = () => {
    const link = `${window.location.origin}/messages?invite=${conversationId}`;
    navigator.clipboard.writeText(link).then(() => flash("Invite link copied!"));
  };

  return (
    <div className="w-full md:w-[350px] border-t md:border-t-0 md:border-l border-zinc-800 bg-zinc-950/95 flex flex-col h-full flex-shrink-0 overflow-hidden relative">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-800/80 bg-zinc-900/10 flex-shrink-0">
        <span className="font-bold text-zinc-150 text-sm">Group Info</span>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {actionMsg && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs text-center animate-pulse flex-shrink-0">
          {actionMsg}
        </div>
      )}

      {/* Main Single Scroll Column */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
        {/* Large Avatar Block */}
        <div className="flex flex-col items-center space-y-3 pb-3 border-b border-zinc-900/60">
          <div className="relative cursor-pointer group" onClick={() => isAdmin && fileRef.current?.click()}>
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-600 to-pink-500 overflow-hidden shadow-lg shadow-violet-950/20">
              {avatarUrl ? (
                <img src={avatarUrl} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Users className="w-10 h-10 text-white" /></div>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-full">
                  <span className="w-6 h-6 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
                </div>
              )}
              {isAdmin && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                  <ImageIcon className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
            {isAdmin && <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />}
          </div>
          <div className="text-center w-full min-w-0">
            {isAdmin ? (
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full bg-transparent border-b border-transparent hover:border-zinc-800 focus:border-violet-500 text-center font-bold text-zinc-100 text-lg outline-none px-2 py-0.5 transition-colors truncate"
              />
            ) : (
              <h2 className="font-bold text-zinc-100 text-lg truncate px-2">{conversationName}</h2>
            )}
            <p className="text-xs text-zinc-500 mt-1">{participants.length} members</p>
          </div>
        </div>

        {/* Group Description */}
        <div className="space-y-1.5 pb-2 border-b border-zinc-900/60">
          <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest block">Description</label>
          {isAdmin ? (
            <textarea
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
              placeholder="Add group description..."
              rows={2}
              className="w-full bg-zinc-900/40 border border-zinc-900 focus:border-violet-500/70 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none transition-all resize-none placeholder-zinc-700"
            />
          ) : (
            <p className="text-xs text-zinc-400 italic bg-zinc-900/20 px-3 py-2.5 rounded-xl border border-zinc-900/30">
              {conversationDescription || "No description provided."}
            </p>
          )}
        </div>

        {/* Action Toggles / Options */}
        <div className="space-y-2 pb-2">
          {isAdmin && (
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-zinc-900/30 border border-zinc-900/60">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <div>
                  <p className="text-xs font-semibold text-zinc-200">Only Admins Send Messages</p>
                  <p className="text-[10px] text-zinc-500">Lock the group conversation</p>
                </div>
              </div>
              <button
                onClick={() => setIsLocked((v) => !v)}
                className={`w-9 h-5 rounded-full transition-all relative flex-shrink-0 ${
                  isLocked ? "bg-violet-500" : "bg-zinc-800"
                }`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                  isLocked ? "left-[calc(100%-18px)]" : "left-0.5"
                }`} />
              </button>
            </div>
          )}

          <button
            onClick={handleCopyInvite}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl bg-zinc-900/30 border border-zinc-900/60 hover:bg-zinc-900/50 transition-colors text-left text-xs text-zinc-300"
          >
            <Link2 className="w-4 h-4 text-violet-400 flex-shrink-0" />
            <span className="flex-1 min-w-0">Copy Invite Link</span>
            <Copy className="w-3 h-3 text-zinc-500" />
          </button>

          {isAdmin && (
            <button
              onClick={handleSaveInfo}
              disabled={saving}
              className="w-full gradient-btn text-white py-2 rounded-xl font-bold text-xs disabled:opacity-40"
            >
              {saving ? "Saving Changes..." : "Save Settings"}
            </button>
          )}
        </div>

        {/* Inline Friends Adder (WhatsApp style) */}
        {isAdmin && (
          <div className="space-y-2 pb-2 border-t border-zinc-900/60 pt-3">
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Add Members</h3>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-650" />
              <input
                value={searchF}
                onChange={(e) => setSearchF(e.target.value)}
                placeholder="Search friends to add..."
                className="w-full bg-zinc-900/30 border border-zinc-900 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-150 outline-none focus:border-violet-500/50"
              />
            </div>

            <div className="max-h-[160px] overflow-y-auto border border-zinc-900 rounded-xl bg-zinc-950/20 divide-y divide-zinc-900/50">
              {loadingF ? (
                <div className="flex items-center justify-center py-4"><span className="w-4 h-4 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" /></div>
              ) : addableFriends.length === 0 ? (
                <p className="text-center text-[10px] text-zinc-600 py-4">No followings found.</p>
              ) : (
                addableFriends.map((f) => {
                  const isSel = selectedNewIds.includes(f.id);
                  return (
                    <div
                      key={f.id}
                      onClick={() => setSelectedNewIds((prev) => isSel ? prev.filter((id) => id !== f.id) : [...prev, f.id])}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-900/40 transition-colors cursor-pointer select-none"
                    >
                      <div className="w-7 h-7 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0">
                        {f.avatarUrl ? <img src={f.avatarUrl} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-zinc-300 text-xs font-semibold">{f.displayName[0]}</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-200 truncate">{f.displayName}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                        isSel ? "bg-violet-500 border-violet-500" : "border-zinc-800 bg-zinc-900/60"
                      }`}>
                        {isSel && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {selectedNewIds.length > 0 && (
              <button
                onClick={handleAddMembers}
                className="w-full bg-violet-600 hover:bg-violet-550 text-white font-semibold py-1.5 rounded-xl text-xs flex items-center justify-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" /> Add Selected ({selectedNewIds.length})
              </button>
            )}
          </div>
        )}

        {/* Current Members List */}
        <div className="space-y-2 border-t border-zinc-900/60 pt-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">{participants.length} Members</h3>
            <input
              value={searchP}
              onChange={(e) => setSearchP(e.target.value)}
              placeholder="Filter list..."
              className="bg-transparent text-[11px] text-zinc-400 outline-none text-right placeholder-zinc-700 w-28"
            />
          </div>

          <div className="space-y-1">
            {loadingP ? (
              <div className="flex items-center justify-center py-4"><span className="w-4 h-4 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" /></div>
            ) : (
              participants
                .filter((p) => p.displayName.toLowerCase().includes(searchP.toLowerCase()) || p.username.toLowerCase().includes(searchP.toLowerCase()))
                .map((p) => (
                  <div key={p.userId} className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-zinc-900/40 transition-colors group">
                    <div className="w-7 h-7 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0">
                      {p.avatarUrl ? (
                        <img src={p.avatarUrl} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs font-semibold">{(p.displayName || "?")[0]}</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-zinc-200 truncate">{p.displayName}</span>
                        {p.role === "ADMIN" && (
                          <span className="flex items-center bg-violet-500/15 text-violet-400 text-[8px] font-bold px-1 rounded-full"><Crown className="w-2 h-2 mr-0.5" />Admin</span>
                        )}
                      </div>
                      <p className="text-[9px] text-zinc-500">@{p.username}</p>
                    </div>

                    {isAdmin && p.userId !== currentUserId && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {p.role !== "ADMIN" ? (
                          <button onClick={() => handlePromote(p.userId)} title="Make Admin" className="p-1 rounded bg-violet-500/10 hover:bg-violet-500/20 text-violet-450">
                            <Shield className="w-3 h-3" />
                          </button>
                        ) : (
                          <button onClick={() => handleDemote(p.userId)} title="Demote member" className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400">
                            <UserCheck className="w-3 h-3" />
                          </button>
                        )}
                        <button onClick={() => handleTransfer(p.userId)} title="Transfer Ownership" className="p-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-500">
                          <Crown className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleKick(p.userId)} title="Remove Member" className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400">
                          <UserX className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Leave button */}
        <div className="pt-2 border-t border-zinc-900/60">
          <button
            onClick={handleLeave}
            className="w-full bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 font-semibold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors border border-rose-500/10"
          >
            <LogOut className="w-3.5 h-3.5" /> Leave Group
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main MessagesClient ──────────────────────────────────────────────────────
type FilterTab = "all" | "unread" | "groups" | "archived";

export default function MessagesClient({
  conversations: initial, currentUserId, currentUser, initialConversationId,
}: {
  conversations: any[];
  currentUserId: string;
  currentUser: any;
  initialConversationId?: string;
}) {
  const router = useRouter();
  const [convs, setConvs] = useState(initial);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [activeConvId, setActiveConvId] = useState<string | null>(initialConversationId ?? null);

  // Sync prop changes (e.g. from router.refresh() background updates)
  useEffect(() => {
    setConvs(initial);
  }, [initial]);

  const activeConv = convs.find((c) => c.id === activeConvId) ?? null;

  const patchConv = (id: string, patch: any) => {
    setConvs((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      const participant = c.participants?.find((p: any) => p.userId === currentUserId);
      if (!participant) return c;
      return { ...c, participants: c.participants.map((p: any) => p.userId === currentUserId ? { ...p, ...patch } : p) };
    }));
  };

  const getParticipant = (c: any) => c.participants?.find((p: any) => p.userId === currentUserId);

  const unreadCount = (c: any) => {
    const msgs = c.messages ?? [];
    return msgs.filter((m: any) => {
      try { const r: string[] = JSON.parse(m.readBy || "[]"); return !r.includes(currentUserId) && m.senderId !== currentUserId; } catch { return false; }
    }).length;
  };

  const filtered = convs.filter((c) => {
    const participant = getParticipant(c);
    const name = c.isGroup ? (c.name ?? "Group") : (c.otherUser?.profile?.displayName ?? "");
    if (search && !name.toLowerCase().includes(search.toLowerCase())) return false;
    if (tab === "groups") return c.isGroup;
    if (tab === "archived") return participant?.isArchived ?? false;
    if (tab === "unread") return unreadCount(c) > 0;
    return !(participant?.isArchived ?? false);
  });

  const sorted = [...filtered].sort((a, b) => {
    const pa = getParticipant(a)?.isPinned ? 1 : 0;
    const pb = getParticipant(b)?.isPinned ? 1 : 0;
    return pb - pa;
  });

  const TABS: { id: FilterTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread" },
    { id: "groups", label: "Groups" },
    { id: "archived", label: "Archived" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className={`${activeConvId ? "hidden md:flex" : "flex"} w-full md:w-80 lg:w-96 border-r border-zinc-800 flex-col h-screen flex-shrink-0`}>
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold gradient-text">Messages</h1>
            <div className="flex gap-2">
              <Link href="/" className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-500 text-xs transition-colors">← Feed</Link>
              <button onClick={() => setNewGroupOpen(true)}
                className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-500 hover:text-violet-400 transition-colors" title="New Group">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500" />
          </div>

          <div className="flex gap-1">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  tab === t.id ? "gradient-btn text-white" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/50">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-600 text-sm gap-2">
              <MessageCircle className="w-10 h-10 opacity-30" />
              <p>{tab === "unread" ? "No unread messages" : tab === "groups" ? "No groups yet" : "No conversations yet"}</p>
              {tab === "all" && <p className="text-xs">Go to a profile and click Message</p>}
            </div>
          ) : (
            sorted.map((c) => {
              const other = c.otherUser;
              const participant = getParticipant(c);
              const avatar = c.isGroup ? c.avatarUrl : other?.profile?.avatarUrl;
              const name = c.isGroup ? (c.name ?? "Group") : (other?.profile?.displayName ?? "Unknown");
              const lastMsg = c.lastMessage?.content ?? (c.lastMessage?.mediaUrl ? "📎 Media" : "Say hello 👋");
              const unread = unreadCount(c);
              const isPinned = participant?.isPinned ?? false;
              const isMuted = participant?.isMuted ?? false;
              const isActive = c.id === activeConvId;

              return (
                <div
                  key={c.id}
                  onClick={() => setActiveConvId(c.id)}
                  className={`flex items-center gap-3 px-4 py-3 w-full text-left transition-colors group cursor-pointer ${
                    isActive ? "bg-violet-500/10 border-r-2 border-violet-500" : "hover:bg-zinc-900"
                  }`}
                >
                  {/* Avatar with online badge */}
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 overflow-hidden">
                      {avatar
                        ? <img src={avatar} className="w-full h-full object-cover" alt={name} />
                        : c.isGroup
                          ? <div className="w-full h-full flex items-center justify-center"><Users className="w-5 h-5 text-white" /></div>
                          : <div className="w-full h-full flex items-center justify-center text-white font-bold">{name[0]}</div>}
                    </div>
                    {unread > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold">{unread}</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        {isPinned && <Pin className="w-3 h-3 text-violet-400 flex-shrink-0" />}
                        <span className={`font-semibold text-sm truncate ${unread > 0 ? "text-zinc-100" : "text-zinc-300"}`}>
                          {name}
                        </span>
                        {isMuted && <BellOff className="w-3 h-3 text-zinc-600 flex-shrink-0" />}
                      </div>
                      {c.lastMessage && (
                        <span className="text-xs text-zinc-500 flex-shrink-0">{timeAgo(c.lastMessage.createdAt)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <p className={`text-xs truncate flex-1 ${unread > 0 ? "text-zinc-200 font-medium" : "text-zinc-500"}`}>
                        {c.lastMessage?.senderId === currentUserId && <span className="text-zinc-600">You: </span>}
                        {lastMsg}
                      </p>
                      {unread === 0 && c.lastMessage?.senderId === currentUserId && (
                        <Check className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                      )}
                    </div>
                  </div>

                  <ConvMenu conv={c} currentUserId={currentUserId} onUpdate={patchConv} />
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex-shrink-0">
          <button onClick={() => setNewGroupOpen(true)}
            className="w-full gradient-btn text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2">
            <Edit3 className="w-4 h-4" />New Group Chat
          </button>
        </div>
      </div>

      {/* Right panel */}
      <div className={`${activeConvId ? "flex" : "hidden md:flex"} flex-1 flex-col h-screen`}>
        {activeConv ? (
          <ChatPanel
            key={activeConvId}
            conversation={activeConv}
            currentUserId={currentUserId}
            currentUser={currentUser}
            onClose={() => setActiveConvId(null)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-zinc-600 flex-col gap-3">
            <MessageCircle className="w-16 h-16 opacity-20" />
            <p className="text-lg font-medium opacity-40">Select a conversation</p>
            <p className="text-sm opacity-30">Or go to someone's profile and click Message</p>
          </div>
        )}
      </div>

      {newGroupOpen && (
        <NewGroupModal
          currentUserId={currentUserId}
          onClose={() => setNewGroupOpen(false)}
          onCreated={(newGroupConv) => {
            // Instantly prepend to local state conversation lists
            setConvs((prev) => [newGroupConv, ...prev.filter((c) => c.id !== newGroupConv.id)]);
            setActiveConvId(newGroupConv.id);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
