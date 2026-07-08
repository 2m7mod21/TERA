"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Send, ArrowLeft, Phone, Video, MoreHorizontal, X, Edit2,
  Trash2, Reply, Smile, Image as ImageIcon, Mic, Paperclip, Check, CheckCheck,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import {
  saveMessage, editMessage, deleteMessage, reactToMessage, markAsRead,
} from "@/server/actions/messaging";

let socket: Socket | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── Emoji Reaction Picker ────────────────────────────────────────────────────
const QUICK_EMOJIS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

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
  const isRead = readBy.some((id) => id !== currentUserId);

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
      {/* Avatar */}
      {!isOwn && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 overflow-hidden flex-shrink-0">
          {msg.sender?.profile?.avatarUrl
            ? <img src={msg.sender.profile.avatarUrl} className="w-full h-full object-cover" alt="" />
            : <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                {msg.sender?.profile?.displayName?.[0] ?? "?"}
              </div>}
        </div>
      )}

      <div className={`relative max-w-[72%]`}>
        {/* Reply context */}
        {msg.replyToId && msg.replyTo && (
          <div className={`mb-1 px-3 py-1.5 rounded-xl border-l-2 border-violet-500 bg-zinc-800/60 text-xs text-zinc-400 truncate`}>
            ↩ {msg.replyTo.content ?? "Media"}
          </div>
        )}

        {/* Bubble */}
        <div className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isOwn ? "gradient-btn text-white rounded-br-sm" : "bg-zinc-800 text-zinc-100 rounded-bl-sm"
        }`}>
          {/* Media */}
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

          {/* Hover actions */}
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

        {/* Reaction pills */}
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

        {/* Timestamp + read receipt */}
        <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? "justify-end" : "justify-start"}`}>
          <span className="text-[10px] text-zinc-600">{timeStr(msg.createdAt)}</span>
          {isOwn && (isRead
            ? <CheckCheck className="w-3 h-3 text-violet-400" />
            : <Check className="w-3 h-3 text-zinc-600" />)}
        </div>
      </div>
    </div>
  );
}

// ─── Main ChatClient ──────────────────────────────────────────────────────────
export default function ChatClient({
  conversationId, initialMessages, conversation, currentUserId, currentUser,
}: {
  conversationId: string;
  initialMessages: any[];
  conversation: any;
  currentUserId: string;
  currentUser: any;
}) {
  const [messages, setMessages] = useState<any[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [editingMsg, setEditingMsg] = useState<any | null>(null);
  const [editInput, setEditInput] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const otherUser = conversation?.otherUser;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark visible messages as read
  useEffect(() => {
    const unread = messages
      .filter((m) => m.senderId !== currentUserId)
      .filter((m) => { try { const r: string[] = JSON.parse(m.readBy || "[]"); return !r.includes(currentUserId); } catch { return true; } })
      .map((m) => m.id);
    if (unread.length > 0) markAsRead(unread);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Socket.IO
  useEffect(() => {
    if (!socket) {
      socket = io("http://localhost:3000", { query: { userId: currentUserId } });
    }
    socket.emit("conversation:join", conversationId);

    socket.on("message:receive", (msg: any) => {
      if (msg.conversationId === conversationId) {
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    });
    socket.on("message:edit", (msg: any) => {
      if (msg.conversationId === conversationId) {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)));
      }
    });
    socket.on("message:delete", ({ id }: { id: string }) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, deletedForAll: true } : m)));
    });
    socket.on("typing:start", (data: any) => {
      if (data.userId !== currentUserId && data.conversationId === conversationId) setTyping(true);
    });
    socket.on("typing:stop", (data: any) => {
      if (data.userId !== currentUserId) setTyping(false);
    });

    return () => {
      socket?.emit("conversation:leave", conversationId);
      socket?.off("message:receive");
      socket?.off("message:edit");
      socket?.off("message:delete");
      socket?.off("typing:start");
      socket?.off("typing:stop");
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
    socket?.emit("typing:start", { conversationId, userId: currentUserId });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket?.emit("typing:stop", { conversationId, userId: currentUserId }), 1500);
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

  const grouped = groupByDate(messages);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="glass border-b border-zinc-800 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <Link href="/messages" className="p-2 rounded-xl hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 overflow-hidden flex-shrink-0">
          {otherUser?.profile?.avatarUrl || conversation?.avatarUrl
            ? <img src={otherUser?.profile?.avatarUrl ?? conversation?.avatarUrl} className="w-full h-full object-cover" alt="" />
            : <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                {(otherUser?.profile?.displayName ?? conversation?.name ?? "G")[0]}
              </div>}
        </div>
        <div className="flex-1 min-w-0">
          {otherUser
            ? <Link href={`/${otherUser.profile?.username}`} className="font-semibold text-zinc-100 hover:text-violet-400 transition-colors text-sm truncate block">
                {otherUser.profile?.displayName}
              </Link>
            : <span className="font-semibold text-sm truncate block">{conversation?.name ?? "Group"}</span>}
          {typing && <p className="text-xs text-violet-400 animate-pulse">typing…</p>}
        </div>
        <div className="flex gap-1">
          <button className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-500 hover:text-violet-400 transition-all" title="Voice call">
            <Phone className="w-5 h-5" />
          </button>
          <button className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-500 hover:text-violet-400 transition-all" title="Video call">
            <Video className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {grouped.map(({ label, messages: dayMsgs }) => (
          <div key={label}>
            {/* Date divider */}
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
      </div>

      {/* Edit mode banner */}
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
  );
}
