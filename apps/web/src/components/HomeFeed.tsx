"use client";

import React, { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { toggleReaction } from "@/server/actions/posts";
import { playSound } from "@/lib/sounds";
import { getFeedPosts } from "@/server/actions/feed";
import TopNav from "@/components/TopNav";
import Stories from "@/components/Stories";
import PostComposer from "@/components/PostComposer";
import RightSidebar from "@/components/RightSidebar";
import VideoPlayer from "@/components/VideoPlayer";
import CommentModal from "@/components/CommentModal";

import {
  Home, Film, MessageCircle, Bell, Users,
  Settings, Shield, LogOut, Eye,
  MessageSquare, Send, MoreHorizontal, Loader2,
  X, User, Bookmark, Hash, Share2, Flag, EyeOff, Edit3, Trash2,
  Pin, Copy, ChevronDown, ChevronUp, Check, Globe, Lock, Users2,
  BarChart2, Heart, Repeat2,
} from "lucide-react";
import ReactionsModal from "./ReactionsModal";
import ReportModal from "@/components/ReportModal";



const VISIBILITY_ICONS: Record<string, React.ReactNode> = {
  PUBLIC:    <Globe className="w-3 h-3" />,
  FRIENDS:   <Users2 className="w-3 h-3" />,
  PRIVATE:   <Lock className="w-3 h-3" />,
};

function timeAgo(date: Date | string) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function ClientTime({ date }: { date: Date | string }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    setLabel(timeAgo(date));
    const id = setInterval(() => setLabel(timeAgo(date)), 30_000);
    return () => clearInterval(id);
  }, [date]);
  return <span suppressHydrationWarning>{label}</span>;
}

// ─── Formatting Mentions and Hashtags ──────────────────────────────────────────
function formatMentionsAndHashtags(text: string) {
  if (!text) return "";
  return text.split(/(\s+)/).map((word: string, i: number) => {
    if (word.startsWith("#") && word.length > 1) {
      const cleanTag = word.slice(1).replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
      return (
        <Link key={i} href={`/explore?tag=${cleanTag}`} className="text-violet-400 hover:underline">
          {word}
        </Link>
      );
    }
    if (word.startsWith("@") && word.length > 1) {
      const cleanUsername = word.slice(1).replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
      return (
        <Link key={i} href={`/${cleanUsername}`} className="text-blue-400 hover:underline">
          {word}
        </Link>
      );
    }
    return <span key={i}>{word}</span>;
  });
}


// ─── Threaded Comment ─────────────────────────────────────────────────────────
export function CommentItem({
  comment,
  currentUserId,
  postAuthorId,
  depth = 0,
  onReplyClick,
}: {
  comment: any;
  currentUserId: string;
  postAuthorId: string;
  depth?: number;
  onReplyClick?: (username: string, parentId: string) => void;
}) {
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [optimisticReactions, setOptimisticReactions] = useState<any[]>(comment.reactions ?? []);
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [deleted, setDeleted] = useState(comment.isDeleted ?? false);
  const [content, setContent] = useState(comment.content);
  const [localReplies, setLocalReplies] = useState<any[]>(comment.replies ?? []);

  const myReaction = optimisticReactions.find((r: any) => r.userId === currentUserId);

  const handleReactComment = (type: string) => {
    startTransition(async () => {
      const prev = [...optimisticReactions];
      if (myReaction?.type === type) {
        setOptimisticReactions(optimisticReactions.filter((r: any) => r.userId !== currentUserId));
        playSound("remove");
      } else {
        setOptimisticReactions([
          ...optimisticReactions.filter((r: any) => r.userId !== currentUserId),
          { userId: currentUserId, type, commentId: comment.id, id: "opt" },
        ]);
        playSound("reaction");
      }
      const { toggleReaction } = await import("@/server/actions/posts");
      const res = await toggleReaction({ commentId: comment.id, type });
      if (!res.success) setOptimisticReactions(prev);
    });
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    const text = replyText; setReplyText("");
    playSound("send");
    const { addComment } = await import("@/server/actions/posts");
    const res = await addComment({ postId: comment.postId, content: text, parentId: comment.id });
    if (res.success && res.comment) {
      setLocalReplies(prev => [...prev, res.comment]);
    }
    setShowReplies(true);
    setShowReplyBox(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { editComment } = await import("@/server/actions/posts");
    const res = await editComment(comment.id, editText);
    if (res.success) { setContent(editText); setEditing(false); }
  };

  const handleDelete = async () => {
    const { deleteComment } = await import("@/server/actions/posts");
    const res = await deleteComment(comment.id);
    if (res.success) setDeleted(true);
  };

  const handlePin = async () => {
    const { pinComment } = await import("@/server/actions/posts");
    await pinComment(comment.id, !comment.isPinned);
  };

  const avatar = comment.user?.profile?.avatarUrl;
  const displayName = comment.user?.profile?.displayName ?? "User";

  return (
    <div className={`flex gap-2 ${depth > 0 ? "ml-8" : ""}`}>
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-pink-600 overflow-hidden flex-shrink-0 mt-0.5">
        {avatar
          ? <img src={avatar} className="w-full h-full object-cover" alt="" />
          : <span className="w-full h-full flex items-center justify-center text-white text-xs font-bold">{displayName[0]}</span>}
      </div>
      <div className="flex-1 min-w-0">
        {deleted ? (
          <p className="text-xs text-zinc-650 italic py-1">This comment was deleted.</p>
        ) : (
          <>
            {comment.isPinned && (
              <div className="flex items-center gap-1 text-xs text-amber-400 mb-1">
                <Pin className="w-3 h-3" /> Pinned comment
              </div>
            )}
            <div className="bg-zinc-800/60 rounded-2xl rounded-tl-none px-3 py-2 text-sm inline-block max-w-full">
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <span className="font-semibold text-xs text-violet-400">{displayName}</span>
                {comment.user?.verifiedBadge && (
                  <span className="text-blue-400 text-[11px]" title="Verified">✓</span>
                )}
                {comment.user?.isAdmin && (
                  <span className="bg-amber-500/10 text-amber-400 text-[9px] px-1 py-0.2 rounded font-bold uppercase tracking-wider" title="Admin">Admin</span>
                )}
                {comment.userId === postAuthorId && (
                  <span className="bg-violet-500/20 text-violet-300 text-[9px] px-1 py-0.2 rounded font-bold uppercase tracking-wider" title="Original Poster">OP</span>
                )}
              </div>
              {editing ? (
                <form onSubmit={handleEdit} className="flex gap-2 items-center">
                  <input
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    className="flex-1 bg-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-100 outline-none"
                    autoFocus
                  />
                  <button type="submit" className="text-violet-400 text-xs"><Check className="w-3 h-3" /></button>
                  <button type="button" onClick={() => setEditing(false)} className="text-zinc-500 text-xs"><X className="w-3 h-3" /></button>
                </form>
              ) : (
                <p className="text-zinc-200 whitespace-pre-wrap">{formatMentionsAndHashtags(content)}</p>
              )}
            </div>

            {/* Comment actions */}
            <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
              <ClientTime date={comment.createdAt} />
              
              <button
                onClick={() => handleReactComment("LOVE")}
                className={`hover:text-zinc-200 transition-colors flex items-center gap-0.5 ${myReaction?.type === "LOVE" ? "text-rose-500 font-semibold" : ""}`}
              >
                <Heart className={`w-3.5 h-3.5 ${myReaction?.type === "LOVE" ? "fill-rose-500 text-rose-500" : "text-zinc-500"}`} />
                {optimisticReactions.length > 0 && (
                  <span className="text-[10px] ml-0.5">{optimisticReactions.length}</span>
                )}
              </button>

              <button
                onClick={() => {
                  if (onReplyClick && comment.user?.profile?.username) {
                    onReplyClick(comment.user.profile.username, comment.parentId || comment.id);
                  } else {
                    setShowReplyBox(v => !v);
                    if (comment.user?.profile?.username) {
                      setReplyText(`@${comment.user.profile.username} `);
                    }
                  }
                }}
                className="hover:text-zinc-250 transition-colors font-medium"
              >
                Reply
              </button>
              {comment.userId === currentUserId && (
                <>
                  <button onClick={() => setEditing(true)} className="hover:text-violet-400">Edit</button>
                  <button onClick={handleDelete} className="hover:text-rose-400">Delete</button>
                </>
              )}
              {postAuthorId === currentUserId && depth === 0 && (
                <button onClick={handlePin} className="hover:text-amber-400">
                  {comment.isPinned ? "Unpin" : "Pin"}
                </button>
              )}
            </div>

            {/* Reply box */}
            {showReplyBox && depth === 0 && (
              <form onSubmit={handleReply} className="flex gap-2 mt-2 ml-2">
                <input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-2xl px-3 py-1.5 text-xs text-zinc-100 outline-none"
                  autoFocus
                />
                <button type="submit" disabled={!replyText.trim()} className="gradient-btn px-2.5 py-1.5 rounded-xl text-white disabled:opacity-40">
                  <Send className="w-3 h-3" />
                </button>
              </form>
            )}

            {/* Nested replies */}
            {localReplies.length > 0 && depth === 0 && (
              <button
                onClick={() => setShowReplies(v => !v)}
                className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 mt-1 ml-2"
              >
                {showReplies ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showReplies ? "Hide" : "View"} {localReplies.length} {localReplies.length === 1 ? "reply" : "replies"}
              </button>
            )}
            {showReplies && localReplies.map((r: any) => (
              <div key={r.id} className="mt-2">
                <CommentItem
                  comment={r}
                  currentUserId={currentUserId}
                  postAuthorId={postAuthorId}
                  depth={1}
                  onReplyClick={(username) => {
                    setShowReplyBox(true);
                    setReplyText(`@${username} `);
                  }}
                />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Comment Panel ────────────────────────────────────────────────────────────
function CommentPanel({
  postId,
  postAuthorId,
  initialComments,
  currentUserId,
}: {
  postId: string;
  postAuthorId: string;
  initialComments: any[];
  currentUserId: string;
}) {
  const [comments, setComments] = useState<any[]>(initialComments ?? []);
  const [commentText, setCommentText] = useState("");
  const [sortBy, setSortBy] = useState<"relevant" | "newest">("relevant");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const fetchComments = useCallback(async (sort: "relevant" | "newest") => {
    setLoading(true);
    const { getComments } = await import("@/server/actions/posts");
    const res = await getComments(postId, sort);
    if (res.success) setComments((res as any).comments);
    setLoading(false);
  }, [postId]);

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    const text = commentText; setCommentText("");
    playSound("comment");
    const { addComment } = await import("@/server/actions/posts");
    const res = await addComment({ postId, content: text });
    if (res.success) {
      setComments(p => [{ ...(res as any).comment, reactions: [], replies: [] }, ...p]);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  const handleSortChange = (sort: "relevant" | "newest") => {
    setSortBy(sort);
    fetchComments(sort);
  };

  return (
    <div className="border-t border-zinc-800/60 px-4 pt-3 pb-2">
      {/* Sort bar */}
      <div className="flex items-center gap-3 mb-3">
        <p className="text-xs font-semibold text-zinc-400">Comments</p>
        <div className="flex gap-1 ml-auto">
          {(["relevant", "newest"] as const).map(s => (
            <button
              key={s}
              onClick={() => handleSortChange(s)}
              className={`text-xs px-2 py-0.5 rounded-lg transition-all ${sortBy === s ? "bg-violet-600/30 text-violet-400" : "text-zinc-600 hover:text-zinc-400"}`}
            >
              {s === "relevant" ? "Top" : "Newest"}
            </button>
          ))}
        </div>
      </div>

      {/* Comment list */}
      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {loading && <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-violet-400" /></div>}
        {!loading && comments.length === 0 && (
          <p className="text-center text-zinc-600 text-xs py-4">Be the first to comment!</p>
        )}
        {comments.map((c: any) => (
          <CommentItem key={c.id} comment={c} currentUserId={currentUserId} postAuthorId={postAuthorId} />
        ))}
        <div ref={endRef} />
      </div>

      {/* Write comment */}
      <form onSubmit={handleComment} className="flex gap-2 mt-3">
        <input
          value={commentText}
          onChange={e => setCommentText(e.target.value)}
          placeholder="Write a comment…"
          className="flex-1 bg-zinc-900 border border-zinc-700 focus:border-violet-500 rounded-2xl px-3.5 py-2 text-sm text-zinc-100 outline-none transition-all"
        />
        <button type="submit" disabled={!commentText.trim()} className="gradient-btn px-3 py-2 rounded-xl text-white disabled:opacity-40">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

// ─── Share Menu ────────────────────────────────────────────────────────────────
function ShareMenu({ post, onClose }: { post: any; onClose: () => void }) {
  const [shared, setShared] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShareNow = async () => {
    const { sharePost } = await import("@/server/actions/posts");
    await sharePost(post.id);
    setShared(true);
    setTimeout(onClose, 1200);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
    setCopied(true);
    setTimeout(() => { setCopied(false); onClose(); }, 2000);
  };

  return (
    <div className="absolute bottom-full left-0 mb-2 w-52 glass rounded-2xl border border-zinc-700 shadow-2xl z-50 overflow-hidden scale-in">
      <button
        onClick={handleShareNow}
        className="flex items-center gap-3 w-full px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
      >
        {shared ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4 text-violet-400" />}
        {shared ? "Shared!" : "Share to Feed"}
      </button>
      <button
        onClick={handleCopyLink}
        className="flex items-center gap-3 w-full px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
      >
        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-zinc-400" />}
        {copied ? "Link copied!" : "Copy Link"}
      </button>
    </div>
  );
}

// ─── Overflow Menu ─────────────────────────────────────────────────────────────
function OverflowMenu({
  post,
  currentUserId,
  onHide,
  onDeleted,
  onEdited,
  onClose,
  onReportClick,
  menuRect,
}: {
  post: any;
  currentUserId: string;
  onHide: () => void;
  onDeleted: () => void;
  onEdited: (content: string) => void;
  onClose: () => void;
  onReportClick: () => void;
  menuRect: DOMRect | null;
}) {
  const isAuthor = post.userId === currentUserId;
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.content ?? "");
  const [linkCopied, setLinkCopied] = useState(false);

  const handleHide = async () => {
    const { hidePost } = await import("@/server/actions/posts");
    await hidePost(post.id, "NOT_INTERESTED");
    onHide();
    onClose();
  };

  const handleReport = async () => {
    onReportClick();
    onClose();
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this post? This action cannot be undone.")) return;
    const { deletePost } = await import("@/server/actions/posts");
    const res = await deletePost(post.id);
    if (res.success) { onDeleted(); onClose(); }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { editPost } = await import("@/server/actions/posts");
    const res = await editPost(post.id, editText);
    if (res.success) { onEdited(editText); onClose(); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
    setLinkCopied(true);
    setTimeout(() => { setLinkCopied(false); onClose(); }, 2000);
  };

  if (editing && menuRect && typeof document !== 'undefined') {
    return createPortal(
      <>
        <div className="fixed inset-0 z-[110]" onMouseDown={onClose} />
        <div
          style={{
            position: 'fixed',
            top: menuRect.bottom + 4,
            left: Math.max(16, menuRect.right - 288),
            zIndex: 111,
          }}
          className="w-72 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-3 text-left overflow-hidden scale-in"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <p className="text-xs font-semibold text-zinc-300 mb-2">Edit post</p>
          <form onSubmit={handleEditSubmit}>
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 focus:border-violet-500 rounded-lg px-2.5 py-2 text-sm text-zinc-100 outline-none resize-none"
              rows={4}
              autoFocus
            />
            <div className="flex gap-2 mt-2 justify-end">
              <button type="button" onClick={() => setEditing(false)} className="text-xs text-zinc-400 px-3 py-1.5 rounded-lg hover:bg-zinc-800">Cancel</button>
              <button type="submit" className="gradient-btn text-xs text-white px-3 py-1.5 rounded-lg">Save</button>
            </div>
          </form>
        </div>
      </>,
      document.body
    );
  }

  return menuRect && typeof document !== 'undefined' ? createPortal(
    <>
      <div className="fixed inset-0 z-[110]" onMouseDown={onClose} />
      <div
        style={{
          position: 'fixed',
          top: menuRect.bottom + 4,
          left: Math.max(16, menuRect.right - 208),
          zIndex: 111,
        }}
        className="w-52 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl py-1 text-left overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button onClick={handleCopy} className="flex items-center gap-3 w-full px-4 py-2.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors">
          {linkCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
          {linkCopied ? "Link copied!" : "Copy Link"}
        </button>
        {!isAuthor && (
          <>
            <button onClick={handleHide} className="flex items-center gap-3 w-full px-4 py-2.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors">
              <EyeOff className="w-3.5 h-3.5 text-zinc-400" /> Hide Post
            </button>
            <button onClick={handleReport} className="flex items-center gap-3 w-full px-4 py-2.5 text-[11px] text-rose-400 hover:bg-zinc-800 transition-colors">
              <Flag className="w-3.5 h-3.5" /> Report Post
            </button>
          </>
        )}
        {isAuthor && (
          <>
            <button onClick={() => setEditing(true)} className="flex items-center gap-3 w-full px-4 py-2.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors">
              <Edit3 className="w-3.5 h-3.5 text-violet-400" /> Edit Post
            </button>
            <button onClick={handleDelete} className="flex items-center gap-3 w-full px-4 py-2.5 text-xs text-rose-400 hover:bg-zinc-800 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Delete Post
            </button>
          </>
        )}
      </div>
    </>,
    document.body
  ) : null;
}

export function PostCard({
  post,
  currentUserId,
  onCommentClick,
}: {
  post: any;
  currentUserId: string;
  onCommentClick?: (postId: string) => void;
}) {
  const displayPost = (post.type === "REPOST" && !post.content && post.parentPost)
    ? post.parentPost
    : post;

  const [showReactionsModal, setShowReactionsModal] = useState(false);
  const [optimisticReactions, setOptimisticReactions] = useState<any[]>(displayPost.reactions ?? []);
  const [initialComments] = useState<any[]>(displayPost.comments ?? []);
  const [showComments, setShowComments] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [isSaved, setIsSaved] = useState(
    (post.bookmarks?.length > 0) || (displayPost.bookmarks?.length > 0)
  );
  const [hidden, setHidden] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editedContent, setEditedContent] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [, startTransition] = useTransition();
  const cardRef = useRef<HTMLDivElement>(null);

  // Repost states
  const [isReposted, setIsReposted] = useState(
    displayPost.shares?.some((s: any) => s.userId === currentUserId && !s.content) ?? false
  );
  const [sharesCount, setSharesCount] = useState(displayPost.shareCount ?? 0);
  const [showRepostMenu, setShowRepostMenu] = useState(false);
  const repostBtnRef = useRef<HTMLButtonElement>(null);
  const [repostMenuRect, setRepostMenuRect] = useState<DOMRect | null>(null);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteText, setQuoteText] = useState("");
  const [submittingQuote, setSubmittingQuote] = useState(false);

  const myReaction = optimisticReactions.find((r: any) => r.userId === currentUserId);
  const totalReactions = optimisticReactions.length;

  const mediaUrls: string[] = (() => {
    try {
      return JSON.parse(displayPost.mediaUrls || "[]");
    } catch {
      return [];
    }
  })();
  const avatar = displayPost.user?.profile?.avatarUrl;
  const displayName = displayPost.user?.profile?.displayName ?? "Unknown";
  const username = displayPost.user?.profile?.username ?? "user";
  const postContent = displayPost.id === post.id ? (editedContent ?? displayPost.content ?? "") : (displayPost.content ?? "");
  const isLong = postContent.length > 280;

  // Sync state if displayPost reactions change
  useEffect(() => {
    setOptimisticReactions(displayPost.reactions ?? []);
  }, [displayPost.reactions]);

  // Track view on mount
  useEffect(() => {
    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0]?.isIntersecting) {
          const { viewPost } = await import("@/server/actions/posts");
          viewPost(displayPost.id);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [displayPost.id]);

  // Close menus on outside click
  useEffect(() => {
    if (!showMenu && !showShare && !showRepostMenu) return;
    const h = (e: MouseEvent) => {
      if (!cardRef.current?.contains(e.target as Node)) {
        setShowMenu(false);
        setShowShare(false);
        setShowRepostMenu(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showMenu, showShare, showRepostMenu]);

  const handleReact = () => {
    startTransition(async () => {
      const prev = [...optimisticReactions];
      const type = "LOVE";
      if (myReaction) {
        setOptimisticReactions(optimisticReactions.filter((r: any) => r.userId !== currentUserId));
        playSound("remove");
        const res = await toggleReaction({ postId: displayPost.id, type: myReaction.type });
        if (!res.success) setOptimisticReactions(prev);
      } else {
        setOptimisticReactions([
          ...optimisticReactions.filter((r: any) => r.userId !== currentUserId),
          { userId: currentUserId, type, postId: displayPost.id, id: "opt" },
        ]);
        playSound("reaction");
        const res = await toggleReaction({ postId: displayPost.id, type });
        if (!res.success) setOptimisticReactions(prev);
      }
    });
  };

  const handleSave = async () => {
    if (isSaved) {
      const { unsavePost } = await import("@/server/actions/posts");
      await unsavePost(post.id);
      playSound("remove");
    } else {
      const { savePost } = await import("@/server/actions/posts");
      await savePost(post.id);
      playSound("save");
    }
    setIsSaved(v => !v);
  };

  const handleRepostToggle = async () => {
    playSound(isReposted ? "remove" : "reaction");
    const originalState = isReposted;
    const originalCount = sharesCount;
    setIsReposted(!originalState);
    setSharesCount((prev: number) => (originalState ? prev - 1 : prev + 1));
    const { repostPost, unrepostPost } = await import("@/server/actions/posts");
    const res = originalState ? await unrepostPost(displayPost.id) : await repostPost(displayPost.id);
    if (!res.success) {
      setIsReposted(originalState);
      setSharesCount(originalCount);
    }
  };

  const handleQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteText.trim() || submittingQuote) return;
    setSubmittingQuote(true);
    playSound("send");
    const { repostPost } = await import("@/server/actions/posts");
    const res = await repostPost(displayPost.id, quoteText);
    if (res.success) {
      setShowQuoteModal(false);
      setQuoteText("");
      setSharesCount((prev: number) => prev + 1);
    }
    setSubmittingQuote(false);
  };

  if (hidden || deleted) return null;

  return (
    <article ref={cardRef} className="glass-light rounded-2xl overflow-hidden mb-3 card-hover fade-in border border-white/[0.04] hover:border-violet-500/20 transition-colors relative">
      {/* Repost attribution header */}
      {post.type === "REPOST" && !post.content && (
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-1 text-xs text-zinc-500 font-medium border-b border-white/[0.02] bg-white/[0.01]">
          <Repeat2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>{post.user?.profile?.displayName ?? "Someone"} reposted</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3">
        <div className="flex items-center gap-3">
          <Link href={`/${username}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 overflow-hidden ring-2 ring-transparent hover:ring-violet-500/50 transition-all">
              {avatar
                ? <img src={avatar} alt={displayName} className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center text-white font-bold text-sm">{displayName[0]}</span>}
            </div>
          </Link>
          <div>
            <div className="flex items-center gap-1.5">
              <Link href={`/${username}`}>
                <p className="font-semibold text-[14px] text-zinc-100 hover:text-violet-400 transition-colors leading-tight">{displayName}</p>
              </Link>
              {displayPost.user?.verifiedBadge && <span className="text-blue-400 text-xs">✓</span>}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-0.5">
              <ClientTime date={displayPost.createdAt} /> ago
              <span className="text-zinc-700">·</span>
              {VISIBILITY_ICONS[displayPost.visibility ?? "PUBLIC"]}
              {displayPost.isEdited && <span className="text-zinc-600 italic">· edited</span>}
              {displayPost.location && <span className="text-zinc-500">· 📍 {displayPost.location}</span>}
              {displayPost.feeling && <span className="text-zinc-500">· 😊 feeling {displayPost.feeling}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleSave}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-zinc-800 ${isSaved ? "text-violet-400" : "text-zinc-500"}`}
          >
            <Bookmark className="w-4 h-4" fill={isSaved ? "currentColor" : "none"} />
          </button>
          <div className="relative">
            <button
              ref={menuBtnRef}
              onClick={() => { 
                if (menuBtnRef.current) setMenuRect(menuBtnRef.current.getBoundingClientRect());
                setShowMenu(v => !v); 
                setShowShare(false); 
              }}
              className="w-8 h-8 rounded-full hover:bg-zinc-800 flex items-center justify-center transition-all"
            >
              <MoreHorizontal className="w-4 h-4 text-zinc-500" />
            </button>
            {showMenu && (
              <OverflowMenu
                post={displayPost}
                currentUserId={currentUserId}
                onHide={() => setHidden(true)}
                onDeleted={() => setDeleted(true)}
                onEdited={(c) => setEditedContent(c)}
                onReportClick={() => setReportOpen(true)}
                onClose={() => setShowMenu(false)}
                menuRect={menuRect}
              />
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {postContent && (
        <div className="px-4 pb-3">
          <p className={`text-zinc-200 text-[15px] leading-relaxed whitespace-pre-wrap ${!expanded && isLong ? "line-clamp-4" : ""}`}>
            {formatMentionsAndHashtags(postContent)}
          </p>
          {isLong && (
            <button onClick={() => setExpanded(v => !v)} className="text-violet-400 text-xs hover:underline mt-1">
              {expanded ? "See less" : "See more"}
            </button>
          )}
        </div>
      )}

      {/* Media Grid */}
      {mediaUrls.length > 0 && (
        <div className={`grid gap-0.5 ${mediaUrls.length > 1 ? "grid-cols-2" : ""}`}>
          {mediaUrls.slice(0, 4).map((url, i) => (
            displayPost.type === "VIDEO" ? (
              <div key={i} className="w-full bg-zinc-900">
                <VideoPlayer src={url} className="w-full max-h-96" />
              </div>
            ) : (
              <div key={i} className="relative overflow-hidden" style={{ paddingBottom: mediaUrls.length === 1 ? "56.25%" : "100%" }}>
                <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                {mediaUrls.length > 4 && i === 3 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">+{mediaUrls.length - 4}</span>
                  </div>
                )}
              </div>
            )
          ))}
        </div>
      )}

      {/* Poll */}
      {displayPost.poll && (
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="w-4 h-4 text-violet-400" />
            <p className="text-sm font-semibold text-zinc-200">{displayPost.poll.question}</p>
          </div>
          {displayPost.poll.options?.map((opt: any) => {
            const total = displayPost.poll.options.reduce((s: number, o: any) => s + o.votes.length, 0);
            const pct = total > 0 ? Math.round((opt.votes.length / total) * 100) : 0;
            const voted = opt.votes.some((v: any) => v.userId === currentUserId);
            return (
              <div key={opt.id} className="relative h-9 rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700 cursor-pointer group"
                onClick={async () => { const { votePoll } = await import("@/server/actions/posts"); await votePoll(opt.id); }}>
                <div className={`absolute inset-y-0 left-0 transition-all duration-700 ${voted ? "gradient-btn opacity-40" : "bg-violet-500/20"}`} style={{ width: `${pct}%` }} />
                <div className="relative z-10 flex justify-between items-center h-full px-3">
                  <span className="text-sm text-zinc-200 flex items-center gap-1.5">
                    {voted && <Check className="w-3 h-3 text-violet-400" />}{opt.text}
                  </span>
                  <span className="text-xs text-zinc-400 font-semibold">{pct}%</span>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-zinc-600">{displayPost.poll.options?.reduce((s: number, o: any) => s + o.votes.length, 0)} votes</p>
        </div>
      )}

      {/* Nested Quote Preview */}
      {post.type === "REPOST" && post.content && post.parentPost && (
        <div className="mx-4 my-2 p-3 bg-zinc-900/60 border border-white/[0.05] rounded-2xl">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-5 h-5 rounded-full bg-zinc-700 overflow-hidden">
              {post.parentPost.user?.profile?.avatarUrl
                ? <img src={post.parentPost.user.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center text-white text-[9px] font-bold">{post.parentPost.user?.profile?.displayName?.[0] ?? "U"}</span>}
            </div>
            <span className="text-xs font-semibold text-zinc-300">{post.parentPost.user?.profile?.displayName}</span>
            <span className="text-[10px] text-zinc-500">@{post.parentPost.user?.profile?.username}</span>
          </div>
          {post.parentPost.content && <p className="text-xs text-zinc-300 line-clamp-3 leading-relaxed">{post.parentPost.content}</p>}
        </div>
      )}

      {/* Engagement summary */}
      {(totalReactions > 0 || (displayPost._count?.comments ?? initialComments.length) > 0 || (displayPost.viewCount ?? 0) > 0 || sharesCount > 0) && (
        <div className="px-4 py-2 flex items-center justify-between border-t border-zinc-800/30">
          <div className="flex items-center gap-1.5">
            {totalReactions > 0 && (
              <button onClick={() => setShowReactionsModal(true)} className="flex items-center gap-1.5 hover:text-rose-400 transition-colors" title="View Reactors">
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                <span className="text-xs text-zinc-500">{totalReactions}</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-600">
            {(displayPost._count?.comments ?? initialComments.length) > 0 && (
              <button onClick={() => setShowComments(v => !v)} className="hover:text-zinc-400">
                {displayPost._count?.comments ?? initialComments.length} comments
              </button>
            )}
            {(displayPost.viewCount ?? 0) > 0 && (
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {displayPost.viewCount} views</span>
            )}
            {sharesCount > 0 && <span>{sharesCount} reposts</span>}
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="px-3 py-1 border-t border-zinc-800/50 flex items-center justify-between">
        {/* Love */}
        <button
          onClick={handleReact}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:bg-zinc-800 group ${myReaction ? "text-rose-500" : "text-zinc-500 hover:text-zinc-200"}`}
        >
          {myReaction
            ? <Heart className="w-5 h-5 fill-rose-500 text-rose-500 animate-heartbeat" />
            : <Heart className="w-5 h-5 text-zinc-500 transition-transform duration-200 group-hover:scale-110" />}
          <span>{myReaction ? "Loved" : "Love"}</span>
        </button>

        {/* Comment */}
        <button
          onClick={() => { if (onCommentClick) { onCommentClick(displayPost.id); } else { setShowComments(v => !v); } }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-all"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Comment</span>
        </button>

        {/* Repost */}
        <button
          ref={repostBtnRef}
          onClick={() => {
            const rect = repostBtnRef.current?.getBoundingClientRect();
            if (rect) setRepostMenuRect(rect);
            setShowRepostMenu(v => !v);
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:bg-zinc-800 group ${isReposted ? "text-emerald-500" : "text-zinc-500 hover:text-zinc-200"}`}
        >
          <Repeat2 className={`w-5 h-5 ${isReposted ? "text-emerald-500" : "transition-transform duration-300 group-hover:rotate-180"}`} />
          <span>Repost</span>
        </button>

        {/* Share */}
        <div className="relative">
          <button
            onClick={() => { setShowShare(v => !v); setShowMenu(false); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-all"
          >
            <Send className="w-4 h-4" />
            <span>Share</span>
          </button>
          {showShare && <ShareMenu post={displayPost} onClose={() => setShowShare(false)} />}
        </div>
      </div>

      {/* Inline comment panel */}
      {showComments && (
        <CommentPanel
          postId={displayPost.id}
          postAuthorId={displayPost.userId}
          initialComments={initialComments}
          currentUserId={currentUserId}
        />
      )}

      {/* === Portals – render above all overflow contexts === */}

      {/* Repost dropdown – portalled to document.body */}
      {showRepostMenu && repostMenuRect && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[9998]" onMouseDown={() => setShowRepostMenu(false)} />
          <div
            style={{
              position: 'fixed',
              top: repostMenuRect.top,
              left: repostMenuRect.left,
              transform: 'translateY(-100%) translateY(-6px)',
              zIndex: 9999,
            }}
            className="bg-zinc-900 border border-white/[0.08] shadow-2xl rounded-2xl py-1 w-44 overflow-hidden animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setShowRepostMenu(false); handleRepostToggle(); }}
              className="w-full px-4 py-2.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-2"
            >
              <Repeat2 className="w-4 h-4 text-zinc-400" />
              <span>{isReposted ? "Undo Repost" : "Repost"}</span>
            </button>
            <button
              onClick={() => { setShowRepostMenu(false); setShowQuoteModal(true); }}
              className="w-full px-4 py-2.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-2"
            >
              <Edit3 className="w-4 h-4 text-zinc-400" />
              <span>Quote Post</span>
            </button>
          </div>
        </>,
        document.body
      )}

      {/* Reactions modal – portalled to document.body */}
      {showReactionsModal && typeof document !== 'undefined' && createPortal(
        <ReactionsModal postId={displayPost.id} onClose={() => setShowReactionsModal(false)} />,
        document.body
      )}

      {/* Quote Repost modal – portalled to document.body */}
      {showQuoteModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onMouseDown={() => setShowQuoteModal(false)}
        >
          <div
            className="w-full max-w-md bg-zinc-950 border border-white/[0.08] rounded-3xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-zinc-100 mb-3">Quote Post</h3>
            <form onSubmit={handleQuoteSubmit} className="space-y-4">
              <textarea
                value={quoteText}
                onChange={e => setQuoteText(e.target.value)}
                placeholder="Add your thoughts..."
                className="w-full h-24 bg-zinc-900 border border-zinc-800 focus:border-violet-500 rounded-xl p-3 text-sm text-zinc-100 outline-none resize-none"
                autoFocus
              />
              <div className="flex justify-end gap-2.5">
                <button type="button" onClick={() => setShowQuoteModal(false)} className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors">Cancel</button>
                <button type="submit" disabled={!quoteText.trim() || submittingQuote} className="gradient-btn px-4 py-2 rounded-xl text-white text-xs font-bold disabled:opacity-40">
                  {submittingQuote ? "Quoting…" : "Post"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Report Modal */}
      {reportOpen && typeof document !== 'undefined' && createPortal(
        <ReportModal
          contentType="POST"
          contentId={displayPost.id}
          reportedUserId={displayPost.userId}
          contentLabel="Post"
          onClose={() => setReportOpen(false)}
        />,
        document.body
      )}
    </article>
  );
}

// ─── Left Sidebar Nav ─────────────────────────────────────────────────────────
const LEFT_NAV = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/explore", icon: Users, label: "Friends" },
  { href: "/messages", icon: MessageCircle, label: "Messages" },
  { href: "/bookmarks", icon: Bookmark, label: "Saved" },
  { href: "/notifications", icon: Bell, label: "Notifications" },
  { href: "/reels", icon: Film, label: "Watch" },
];

// ─── Home Feed ────────────────────────────────────────────────────────────────
export default function HomeFeed({
  initialPosts,
  initialCursor,
  user,
  suggested = [],
  trending = [],
  active = [],
  initialStories = [],
  notifCount = 0,
}: {
  initialPosts: any[];
  initialCursor: string | null;
  user: any;
  suggested?: any[];
  trending?: any[];
  active?: any[];
  initialStories?: any[];
  notifCount?: number;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [feedType, setFeedType] = useState<"foryou" | "recent">("foryou");
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleFeedTypeChange = async (type: "foryou" | "recent") => {
    if (type === feedType) return;
    setFeedType(type);
    setPosts([]);
    setCursor(null);
    setLoadingMore(true);
    const { posts: newPosts, nextCursor } = await getFeedPosts(undefined, type);
    setPosts(newPosts);
    setCursor(nextCursor ?? null);
    setLoadingMore(false);
  };

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const { posts: more, nextCursor } = await getFeedPosts(cursor, feedType);
    setPosts(p => [...p, ...(more as any[])]);
    setCursor(nextCursor ?? null);
    setLoadingMore(false);
  }, [cursor, loadingMore, feedType]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMore(); },
      { rootMargin: "600px" }
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [loadMore]);

  const currentUserId = user?.id ?? "";
  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const commentsQueryId = searchParams.get("comments");

  useEffect(() => {
    setOpenCommentsPostId(commentsQueryId);
  }, [commentsQueryId]);

  const handleOpenComments = (postId: string) => {
    setOpenCommentsPostId(postId);
    const params = new URLSearchParams(window.location.search);
    params.set("comments", postId);
    window.history.pushState(null, "", `?${params.toString()}`);
  };

  const handleCloseComments = () => {
    setOpenCommentsPostId(null);
    const params = new URLSearchParams(window.location.search);
    if (params.has("comments")) {
      params.delete("comments");
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "");
      window.history.pushState(null, "", newUrl);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopNav user={user} notifCount={notifCount} />

      <div className="flex max-w-[1280px] mx-auto pt-14">
        {/* ── Left Sidebar ── */}
        <aside className="hidden lg:flex flex-col fixed left-0 top-14 h-[calc(100vh-56px)] w-72 px-3 py-4 overflow-y-auto z-30">
          <Link
            href={user?.username ? `/${user.username}` : "#"}
            className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-zinc-800/60 transition-all mb-2 group"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 overflow-hidden flex-shrink-0">
              {user?.image
                ? <img src={user.image} alt="" className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center text-white font-bold">{user?.name?.[0] ?? "U"}</span>}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-zinc-100 text-sm truncate group-hover:text-violet-400 transition-colors">{user?.name || "User"}</p>
              <p className="text-xs text-zinc-500 truncate">View your profile</p>
            </div>
          </Link>

          <nav className="space-y-0.5 mt-1">
            {LEFT_NAV.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100 transition-all group"
              >
                <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-600/20 group-hover:text-violet-400 transition-all">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="font-medium text-sm">{label}</span>
              </Link>
            ))}
            {user?.username && (
              <Link href={`/${user.username}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100 transition-all group">
                <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-600/20 group-hover:text-violet-400 transition-all">
                  <User className="w-5 h-5" />
                </div>
                <span className="font-medium text-sm">Profile</span>
              </Link>
            )}
            {user?.isAdmin && (
              <Link href="/admin" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-amber-400 hover:bg-amber-500/10 transition-all group">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <span className="font-medium text-sm">Admin Panel</span>
              </Link>
            )}
          </nav>

          <div className="mt-auto pt-4 border-t border-zinc-800">
            <Link href="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-500 hover:bg-zinc-800/70 hover:text-zinc-300 transition-all">
              <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
                <Settings className="w-5 h-5" />
              </div>
              <span className="font-medium text-sm">Settings</span>
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 transition-all w-full text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <span className="font-medium text-sm">Sign Out</span>
            </button>
          </div>
        </aside>

        {/* ── Center Feed ── */}
        <main className="flex-1 lg:ml-72 lg:mr-80 xl:mr-88 min-h-screen pt-4 px-3 pb-10 max-w-2xl mx-auto lg:mx-0">
          <Stories currentUser={user} stories={initialStories} />

          {/* Feed Toggle */}
          <div className="flex border-b border-zinc-800/80 mb-4 sticky top-14 bg-zinc-950/80 backdrop-blur-md z-10 px-2 py-1 gap-4">
            {(["foryou", "recent"] as const).map(type => (
              <button
                key={type}
                onClick={() => handleFeedTypeChange(type)}
                className={`pb-3 pt-2 text-sm font-semibold tracking-wide transition-all relative ${feedType === type ? "text-violet-400 font-bold" : "text-zinc-400 hover:text-zinc-200"}`}
              >
                {type === "foryou" ? "For You" : "Recent"}
                {feedType === type && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-pink-500 rounded-full" />
                )}
              </button>
            ))}
          </div>

          <PostComposer user={user} />

          {posts.length === 0 && !loadingMore ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full gradient-btn mx-auto flex items-center justify-center mb-4 opacity-60">
                <Hash className="w-10 h-10 text-white" />
              </div>
              <p className="text-lg font-semibold text-zinc-300">Your feed is empty</p>
              <p className="text-sm text-zinc-500 mt-1">Follow people to see their posts here</p>
              <Link href="/explore" className="mt-4 inline-block gradient-btn text-white px-6 py-2.5 rounded-xl font-semibold text-sm">
                Explore
              </Link>
            </div>
          ) : (
            posts.map((post: any) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                onCommentClick={handleOpenComments}
              />
            ))
          )}

          <div ref={sentinelRef} className="h-8" />
          {loadingMore && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
            </div>
          )}
          {!cursor && posts.length > 0 && (
            <p className="text-center text-xs text-zinc-600 pb-4">You've seen all posts ✓</p>
          )}
        </main>

        {/* ── Right Sidebar ── */}
        <aside className="hidden lg:block fixed right-0 top-14 h-[calc(100vh-56px)] w-80 xl:w-88 px-4 py-4 overflow-y-auto z-30">
          <RightSidebar suggested={suggested} trending={trending} active={active} />
        </aside>
      </div>

      {openCommentsPostId && (
        <CommentModal
          postId={openCommentsPostId}
          currentUserId={currentUserId}
          onClose={handleCloseComments}
        />
      )}
    </div>
  );
}
