"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { getFeedPosts } from "@/server/actions/feed";
import { PostCard } from "@/components/HomeFeed";
import TopNav from "@/components/TopNav";
import RightSidebar from "@/components/RightSidebar";
import CommentModal from "@/components/CommentModal";
import {
  Home, Film, MessageCircle, Bell, Users,
  Settings, LogOut, User, Bookmark, Shield,
  Loader2, Hash, ArrowLeft,
} from "lucide-react";

const LEFT_NAV = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/explore", icon: Users, label: "Friends" },
  { href: "/messages", icon: MessageCircle, label: "Messages" },
  { href: "/bookmarks", icon: Bookmark, label: "Saved" },
  { href: "/notifications", icon: Bell, label: "Notifications" },
  { href: "/reels", icon: Film, label: "Watch" },
];

export default function PostPageClient({
  post,
  feedPosts,
  feedCursor,
  user,
  suggested = [],
  trending = [],
  active = [],
}: {
  post: any;
  feedPosts: any[];
  feedCursor: string | null;
  user: any;
  suggested?: any[];
  trending?: any[];
  active?: any[];
}) {
  const [posts, setPosts] = useState<any[]>(feedPosts);
  const [cursor, setCursor] = useState<string | null>(feedCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
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

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const { posts: more, nextCursor } = await getFeedPosts(cursor);
    setPosts((p) => [...p, ...(more as any[])]);
    setCursor(nextCursor ?? null);
    setLoadingMore(false);
  }, [cursor, loadingMore]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMore(); },
      { rootMargin: "600px" }
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [loadMore]);

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopNav user={user} />

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

        {/* ── Center Content ── */}
        <main className="flex-1 lg:ml-72 lg:mr-80 xl:mr-88 min-h-screen pt-4 px-3 pb-10 max-w-2xl mx-auto lg:mx-0">
          {/* Back link */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-violet-400 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Feed
          </Link>

          {/* Pinned post */}
          <div className="mb-6">
            <p className="text-xs text-zinc-600 uppercase tracking-widest font-semibold px-1 mb-2">Post</p>
            <PostCard post={post} currentUserId={currentUserId} onCommentClick={handleOpenComments} />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4 px-1">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-xs text-zinc-600 font-medium">More posts</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          {/* Infinite feed below */}
          {posts.length === 0 && !loadingMore ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full gradient-btn mx-auto flex items-center justify-center mb-3 opacity-50">
                <Hash className="w-8 h-8 text-white" />
              </div>
              <p className="text-zinc-500 text-sm">No other posts yet</p>
            </div>
          ) : (
            posts.map((p: any) => (
              <PostCard key={p.id} post={p} currentUserId={currentUserId} onCommentClick={handleOpenComments} />
            ))
          )}

          <div ref={sentinelRef} className="h-8" />
          {loadingMore && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
            </div>
          )}
          {!cursor && posts.length > 0 && (
            <p className="text-center text-xs text-zinc-600 pb-4">You&apos;ve seen all posts ✓</p>
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
