"use client";

import React, {
  useState, useCallback, useEffect, useRef, useMemo
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Heart, MessageCircle, Bookmark, Share2, Music2,
  ChevronUp, ChevronDown, X, Send, Volume2, VolumeX,
  Play, Pause, UserPlus, Check, Home, Search
} from "lucide-react";
import { getVideoPosts } from "@/server/actions/feed";
import { toggleReaction, addComment, getComments, savePost, unsavePost } from "@/server/actions/posts";
import { followUser, unfollowUser } from "@/server/actions/social";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCount(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(".0", "") + "K";
  return String(n);
}

function timeAgo(date: string | Date) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// ─── Comments Bottom Sheet ─────────────────────────────────────────────────────
function CommentsSheet({
  postId,
  onClose,
}: {
  postId: string;
  currentUserId: string;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await getComments(postId, "newest");
      if (res.success) setComments(res.comments ?? []);
      setLoading(false);
    })();
  }, [postId]);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    const res = await addComment({ postId, content: text });
    if (res.success && res.comment) {
      setComments(prev => [res.comment, ...prev]);
      setText("");
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-[200]" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 h-[70vh] bg-zinc-900 rounded-t-3xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle + Header */}
        <div className="flex flex-col items-center pt-3 pb-2 border-b border-zinc-800 flex-shrink-0">
          <div className="w-10 h-1 bg-zinc-600 rounded-full mb-3" />
          <div className="flex items-center justify-between w-full px-4">
            <span className="text-white font-bold text-base">{fmtCount(comments.length)} Comments</span>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-10 text-zinc-500">
              <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No comments yet. Be the first!</p>
            </div>
          ) : (
            comments.map((c: any) => (
              <div key={c.id} className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 overflow-hidden flex-shrink-0">
                  {c.user?.profile?.avatarUrl
                    ? <img src={c.user.profile.avatarUrl} className="w-full h-full object-cover" alt="" />
                    : <span className="w-full h-full flex items-center justify-center text-white text-xs font-bold">{c.user?.profile?.displayName?.[0] ?? "U"}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold text-sm">{c.user?.profile?.displayName}</span>
                    <span className="text-zinc-500 text-xs">{timeAgo(c.createdAt)}</span>
                  </div>
                  <p className="text-zinc-200 text-sm mt-0.5 break-words">{c.content}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <button className="text-zinc-500 text-xs hover:text-zinc-300">Reply</button>
                    <span className="text-zinc-600 text-xs flex items-center gap-0.5">
                      <Heart className="w-3 h-3" /> {c.reactions?.length ?? 0}
                    </span>
                  </div>
                  {/* Replies */}
                  {c.replies?.length > 0 && (
                    <div className="mt-2 ml-2 space-y-2 border-l-2 border-zinc-800 pl-3">
                      {c.replies.map((r: any) => (
                        <div key={r.id} className="flex gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 overflow-hidden flex-shrink-0">
                            {r.user?.profile?.avatarUrl
                              ? <img src={r.user.profile.avatarUrl} className="w-full h-full object-cover" alt="" />
                              : <span className="w-full h-full flex items-center justify-center text-white text-[8px] font-bold">{r.user?.profile?.displayName?.[0]}</span>}
                          </div>
                          <div>
                            <span className="text-white font-semibold text-xs">{r.user?.profile?.displayName} </span>
                            <span className="text-zinc-300 text-xs">{r.content}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-t border-zinc-800 bg-zinc-950 flex-shrink-0 pb-safe">
          <div className="flex-1 bg-zinc-800 rounded-full px-4 py-2.5 flex items-center">
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder="Add a comment..."
              className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center disabled:opacity-40"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Share Sheet ───────────────────────────────────────────────────────────────
function ShareSheet({ postId, onClose }: { postId: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/post/${postId}` : "";

  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[200]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-zinc-600 rounded-full mx-auto mb-4" />
        <h3 className="text-white font-bold text-base mb-4 text-center">Share Video</h3>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={copy} className="flex items-center gap-3 bg-zinc-800 rounded-2xl p-4 hover:bg-zinc-700 transition-colors">
            <div className="w-10 h-10 bg-violet-600 rounded-full flex items-center justify-center">
              {copied ? <Check className="w-5 h-5 text-white" /> : <Share2 className="w-5 h-5 text-white" />}
            </div>
            <span className="text-white font-medium text-sm">{copied ? "Copied!" : "Copy Link"}</span>
          </button>
          <Link
            href={`/post/${postId}`}
            className="flex items-center gap-3 bg-zinc-800 rounded-2xl p-4 hover:bg-zinc-700 transition-colors"
            onClick={onClose}
          >
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <Home className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-medium text-sm">View Post</span>
          </Link>
        </div>
        <button onClick={onClose} className="w-full mt-4 py-3 text-zinc-400 text-sm font-medium">Cancel</button>
      </div>
    </div>
  );
}

// ─── Single Video Item ─────────────────────────────────────────────────────────
function VideoItem({
  post,
  currentUserId,
  isActive,
  shouldLoad,
  preloadType,
  globalMuted,
  onMuteChange,
  onProgress,
}: {
  post: any;
  currentUserId: string;
  isActive: boolean;
  shouldLoad: boolean;
  preloadType: "auto" | "metadata" | "none";
  globalMuted: boolean;
  onMuteChange: (muted: boolean) => void;
  onProgress?: (progress: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [liked, setLiked] = useState(() =>
    post.reactions?.some((r: any) => r.userId === currentUserId)
  );
  const [likeCount, setLikeCount] = useState(post._count?.reactions ?? post.reactions?.length ?? 0);
  const [saved, setSaved] = useState(() =>
    post.bookmarks?.length > 0
  );
  const [following, setFollowing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [doubleTapHeart, setDoubleTapHeart] = useState(false);
  const [centerIcon, setCenterIcon] = useState<"play" | "pause" | null>(null);
  const doubleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapCount = useRef(0);

  const mediaUrls = useMemo(() => {
    try { return JSON.parse(post.mediaUrls || "[]") as string[]; }
    catch { return []; }
  }, [post.mediaUrls]);

  const videoUrl = mediaUrls[0] ?? "";
  const avatar = post.user?.profile?.avatarUrl;
  const username = post.user?.profile?.username ?? "user";
  const displayName = post.user?.profile?.displayName ?? "User";
  const caption = post.content ?? "";
  const commentCount = post._count?.comments ?? 0;

  // Play/pause on active change
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      v.muted = globalMuted;
      v.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      v.pause();
      v.currentTime = 0;
      setPlaying(false);
    }
  }, [isActive]);

  // Sync muted state
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = globalMuted;
  }, [globalMuted]);

  // Progress bar
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const update = () => {
      const p = v.duration ? (v.currentTime / v.duration) * 100 : 0;
      setProgress(p);
      if (isActive && onProgress) {
        onProgress(p);
      }
    };
    v.addEventListener("timeupdate", update);
    return () => v.removeEventListener("timeupdate", update);
  }, [isActive, onProgress]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().then(() => setPlaying(true));
      setCenterIcon("play");
    } else {
      v.pause();
      setPlaying(false);
      setCenterIcon("pause");
    }
    setTimeout(() => setCenterIcon(null), 700);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMuteChange(!globalMuted);
  };

  const handleTap = (_e: React.MouseEvent) => {
    tapCount.current += 1;
    if (doubleTapTimer.current) clearTimeout(doubleTapTimer.current);
    doubleTapTimer.current = setTimeout(() => {
      if (tapCount.current >= 2) {
        // Double tap → like
        handleDoubleTapLike();
      } else {
        // Single tap → play/pause
        togglePlay();
      }
      tapCount.current = 0;
    }, 250);
  };

  const handleDoubleTapLike = async () => {
    if (!liked) {
      setLiked(true);
      setLikeCount((n: number) => n + 1);
      await toggleReaction({ postId: post.id, type: "LIKE" });
    }
    setDoubleTapHeart(true);
    setTimeout(() => setDoubleTapHeart(false), 1000);
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount((n: number) => newLiked ? n + 1 : Math.max(0, n - 1));
    await toggleReaction({ postId: post.id, type: "LIKE" });
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saved) {
      setSaved(false);
      await unsavePost(post.id);
    } else {
      setSaved(true);
      await savePost(post.id);
    }
  };

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (following) {
      setFollowing(false);
      await unfollowUser(post.user.id);
    } else {
      setFollowing(true);
      await followUser(post.user.id);
    }
  };

  const [captionExpanded, setCaptionExpanded] = useState(false);
  const isLongCaption = caption.length > 80;

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Video */}
      {videoUrl && shouldLoad && (
        <video
          ref={videoRef}
          src={videoUrl}
          className="absolute inset-0 w-full h-full object-cover"
          loop
          playsInline
          preload={preloadType}
          muted={globalMuted}
          onClick={handleTap}
        />
      )}

      {/* No video placeholder */}
      {!videoUrl && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 cursor-pointer" onClick={handleTap}>
          <div className="text-center">
            <Music2 className="w-16 h-16 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">No video available</p>
          </div>
        </div>
      )}

      {/* Double‑tap heart animation */}
      {doubleTapHeart && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <Heart className="w-28 h-28 fill-white text-white opacity-90 animate-[heartburst_0.9s_ease_forwards]" />
        </div>
      )}

      {/* Center play/pause flash */}
      {centerIcon && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-16 h-16 bg-black/40 backdrop-blur rounded-full flex items-center justify-center">
            {centerIcon === "pause"
              ? <Pause className="w-8 h-8 text-white" />
              : <Play className="w-8 h-8 text-white" />}
          </div>
        </div>
      )}

      {/* Dark gradient overlay – bottom */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none z-10"
        style={{ height: "55%", background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)" }}
      />

      {/* Dark gradient overlay – top (softer, for nav) */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none z-10"
        style={{ height: "15%", background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)" }}
      />

      {/* Mute button – top right */}
      <button
        onClick={toggleMute}
        className="absolute top-14 end-4 z-30 w-10 h-10 bg-black/40 backdrop-blur rounded-full flex items-center justify-center"
      >
        {globalMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
      </button>

      {/* ── Right action bar ─────────────────────────── */}
      <div className="absolute end-3 bottom-24 z-30 flex flex-col items-center gap-5">

        {/* Avatar + follow */}
        {post.user?.id !== currentUserId && (
          <div className="relative flex flex-col items-center">
            <Link href={`/${username}`} onClick={e => e.stopPropagation()} className="w-12 h-12 rounded-full border-2 border-white overflow-hidden block">
              {avatar
                ? <img src={avatar} className="w-full h-full object-cover" alt="" />
                : <div className="w-full h-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white font-bold">{displayName[0]}</div>}
            </Link>
            {!following && (
              <button
                onClick={handleFollow}
                className="absolute -bottom-2 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center border border-black"
              >
                <UserPlus className="w-3 h-3 text-white" />
              </button>
            )}
            {following && (
              <button
                onClick={handleFollow}
                className="absolute -bottom-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border border-black"
              >
                <Check className="w-3 h-3 text-white" />
              </button>
            )}
          </div>
        )}

        {/* Like */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={handleLike}
            className={`w-12 h-12 flex items-center justify-center transition-transform active:scale-90 ${liked ? "scale-110" : ""}`}
          >
            <Heart
              className={`w-8 h-8 transition-all duration-200 ${liked ? "fill-rose-500 text-rose-500 scale-110" : "text-white fill-white/10"}`}
            />
          </button>
          <span className="text-white text-xs font-semibold drop-shadow">{fmtCount(likeCount)}</span>
        </div>

        {/* Comments */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); setShowComments(true); }}
            className="w-12 h-12 flex items-center justify-center"
          >
            <MessageCircle className="w-8 h-8 text-white fill-white/10" />
          </button>
          <span className="text-white text-xs font-semibold drop-shadow">{fmtCount(commentCount)}</span>
        </div>

        {/* Bookmark */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={handleSave}
            className="w-12 h-12 flex items-center justify-center"
          >
            <Bookmark className={`w-7 h-7 transition-all ${saved ? "fill-yellow-400 text-yellow-400" : "text-white fill-white/10"}`} />
          </button>
          <span className="text-white text-xs font-semibold drop-shadow">Save</span>
        </div>

        {/* Share */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); setShowShare(true); }}
            className="w-12 h-12 flex items-center justify-center"
          >
            <Share2 className="w-7 h-7 text-white fill-white/10" />
          </button>
          <span className="text-white text-xs font-semibold drop-shadow">Share</span>
        </div>

        {/* Spinning music disc */}
        <div className="w-10 h-10 rounded-full bg-zinc-800 border-4 border-zinc-600 overflow-hidden flex items-center justify-center"
          style={{ animation: playing ? "spin 4s linear infinite" : "none" }}>
          {avatar
            ? <img src={avatar} className="w-full h-full object-cover" alt="" />
            : <Music2 className="w-4 h-4 text-violet-400" />}
        </div>
      </div>

      {/* ── Bottom info overlay ──────────────────────── */}
      <div className="absolute bottom-8 start-4 end-20 z-30">
        <Link href={`/${username}`} onClick={e => e.stopPropagation()} className="group inline-flex items-center gap-2 mb-2">
          <span className="text-white font-bold text-base drop-shadow">@{username}</span>
        </Link>

        {caption && (
          <div className="mb-2">
            <p className={`text-white text-sm leading-snug drop-shadow ${!captionExpanded && isLongCaption ? "line-clamp-2" : ""}`}>
              {caption.split(/(\s+)/).map((word: string, i: number) =>
                word.startsWith("#")
                  ? <span key={i} className="text-violet-300">{word}</span>
                  : word
              )}
            </p>
            {isLongCaption && (
              <button
                onClick={e => { e.stopPropagation(); setCaptionExpanded(v => !v); }}
                className="text-white/60 text-xs mt-0.5"
              >
                {captionExpanded ? "See less" : "...See more"}
              </button>
            )}
          </div>
        )}

        {/* Music tag */}
        <div className="flex items-center gap-1.5 mt-1">
          <Music2 className="w-3.5 h-3.5 text-white/80 flex-shrink-0" />
          <span className="text-white/80 text-xs truncate max-w-[180px]">Original Sound – @{username}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20 z-30">
        <div
          className="h-full bg-white transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Modals */}
      {showComments && (
        <CommentsSheet
          postId={post.id}
          currentUserId={currentUserId}
          onClose={() => setShowComments(false)}
        />
      )}
      {showShare && (
        <ShareSheet postId={post.id} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}

// ─── Main WatchClient ──────────────────────────────────────────────────────────
export default function WatchClient({
  initialPosts,
  initialCursor,
  user,
}: {
  initialPosts: any[];
  initialCursor: string | null;
  user: any;
  suggested?: any[];
  trending?: any[];
  active?: any[];
}) {
  const [posts, setPosts] = useState<any[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeProgress, setActiveProgress] = useState(0);
  const [globalMuted, setGlobalMuted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentUserId = user?.id ?? "";
  const router = useRouter();

  // Reset activeProgress on slide change
  useEffect(() => {
    setActiveProgress(0);
  }, [activeIndex]);

  // Infinite load
  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const { posts: more, nextCursor } = await getVideoPosts(cursor, 10);
    setPosts(p => [...p, ...(more as any[])]);
    setCursor(nextCursor ?? null);
    setLoadingMore(false);
  }, [cursor, loadingMore]);

  // Intersection Observer per slide
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const slides = container.querySelectorAll("[data-slide]");
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = Number((entry.target as HTMLElement).dataset.slide);
          setActiveIndex(idx);
          // Load more when 3 from end
          if (idx >= posts.length - 3) loadMore();
        }
      });
    }, { threshold: 0.6 });

    slides.forEach(s => obs.observe(s));
    return () => obs.disconnect();
  }, [posts.length, loadMore]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const next = e.key === "ArrowDown" ? Math.min(activeIndex + 1, posts.length - 1) : e.key === "ArrowUp" ? Math.max(activeIndex - 1, 0) : null;
      if (next !== null) {
        container.querySelectorAll("[data-slide]")[next]?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, posts.length]);

  // Pause videos when tab hidden
  useEffect(() => {
    const handler = () => {
      if (document.hidden) {
        document.querySelectorAll("video").forEach(v => v.pause());
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  if (posts.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4 z-50">
        <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center">
          <Music2 className="w-10 h-10 text-zinc-500" />
        </div>
        <p className="text-white text-lg font-bold">No videos yet</p>
        <p className="text-zinc-500 text-sm">Upload a video to see it here!</p>
        <button onClick={() => router.push("/")} className="mt-4 px-6 py-2.5 gradient-btn text-white rounded-2xl font-semibold text-sm">
          Back to Feed
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 overflow-hidden">
      {/* Top controls */}
      <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-4 pt-4 pb-2">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center"
        >
          <X className="w-5 h-5 text-white" />
        </button>
        <span className="text-white font-bold text-base tracking-wide">Watch</span>
        <button
          onClick={() => router.push("/explore")}
          className="w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center"
        >
          <Search className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Video feed – vertical scroll snap */}
      <div
        ref={containerRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {posts.map((post, idx) => {
          const isCurrent = activeIndex === idx;
          const isNext = idx === activeIndex + 1;
          const isPrev = idx === activeIndex - 1;
          const shouldLoad = isCurrent || isNext || isPrev;
          const preloadType = isCurrent ? "auto" : (isNext && activeProgress > 50) ? "auto" : "metadata";

          return (
            <div
              key={post.id}
              data-slide={idx}
              className="w-full flex-shrink-0"
              style={{
                height: "100dvh",
                scrollSnapAlign: "start",
              }}
            >
              <VideoItem
                post={post}
                currentUserId={currentUserId}
                isActive={isCurrent}
                shouldLoad={shouldLoad}
                preloadType={preloadType}
                globalMuted={globalMuted}
                onMuteChange={setGlobalMuted}
                onProgress={isCurrent ? setActiveProgress : undefined}
              />
            </div>
          );
        })}

        {/* Loading sentinel */}
        {loadingMore && (
          <div className="flex justify-center items-center" style={{ height: "100dvh" }}>
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Nav hint arrows (desktop only) */}
      <div className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 z-40 flex-col gap-2">
        <button
          onClick={() => {
            const c = containerRef.current;
            if (c && activeIndex > 0) {
              c.querySelectorAll("[data-slide]")[activeIndex - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
        >
          <ChevronUp className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={() => {
            const c = containerRef.current;
            if (c && activeIndex < posts.length - 1) {
              c.querySelectorAll("[data-slide]")[activeIndex + 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
        >
          <ChevronDown className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
}
