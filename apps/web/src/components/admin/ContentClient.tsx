"use client";

import React, { useState, useTransition } from "react";
import { Search, EyeOff, Trash2, Pin, PinOff, Eye } from "lucide-react";
import { getContent, deletePost, hidePost, pinPost } from "@/server/actions/admin/content";

export default function ContentClient({
  initialPosts,
  initialCursor,
}: {
  initialPosts: any[];
  initialCursor: string | null;
}) {
  const [posts, setPosts] = useState<any[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleFetch = (searchVal = search, reset = false) => {
    startTransition(async () => {
      const res = await getContent({
        search: searchVal || undefined,
        cursor: reset ? undefined : (cursor || undefined),
      });
      if (reset) setPosts(res.posts);
      else setPosts((prev) => [...prev, ...res.posts]);
      setCursor(res.nextCursor);
    });
  };

  const handleAction = (postId: string, actionFn: (id: string, ...args: any[]) => Promise<any>, ...args: any[]) => {
    if (!confirm("Are you sure?")) return;
    startTransition(async () => {
      const res = await actionFn(postId, ...args);
      if (res.success) {
        handleFetch(search, true);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Content Library</h1>
        <p className="text-xs text-slate-500">Monitor posts, toggle content visibility settings, and purge platform updates.</p>
      </div>

      {/* Filter and Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
        <input
          type="text"
          placeholder="Filter content text or author..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            handleFetch(e.target.value, true);
          }}
          className="w-full pl-9 pr-4 py-1.5 bg-[#0d0d14] border border-white/5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-violet-500 transition-colors"
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {posts.map((p) => (
          <div key={p.id} className="glass border border-white/5 p-5 rounded-2xl bg-white/[0.01] space-y-4 hover:border-white/10 transition-colors">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center font-bold text-[10px] text-slate-400 capitalize">
                  {(p.user?.profile?.displayName ?? "U")[0]}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-300">{p.user?.profile?.displayName}</p>
                  <p className="text-[9px] text-slate-500">@{p.user?.profile?.username} · {new Date(p.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="flex gap-1">
                {p.isPinned && (
                  <span className="p-1 rounded bg-violet-500/10 border border-violet-500/20 text-violet-400" title="Pinned Post">
                    <Pin className="w-3 h-3 fill-violet-400/20" />
                  </span>
                )}
                {p.visibility === "PRIVATE" && (
                  <span className="p-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 animate-pulse text-[9px] font-bold px-2 py-0.5" title="Hidden/Private">
                    Private
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-350 leading-relaxed font-medium break-all whitespace-pre-wrap">
              {p.content}
            </p>

            <div className="flex justify-between items-center text-[10px] text-slate-550 border-t border-white/5 pt-3">
              <div className="flex gap-3">
                <span>{p._count?.reactions ?? 0} Likes</span>
                <span>{p._count?.comments ?? 0} Comments</span>
                {p._count?.reports > 0 && (
                  <span className="text-rose-400 font-bold">{p._count.reports} Reports pending</span>
                )}
              </div>

              <div className="flex gap-1.5">
                <button
                  onClick={() => handleAction(p.id, pinPost, !p.isPinned)}
                  className="p-1.5 rounded bg-[#0d0d14] border border-white/5 text-slate-450 hover:text-slate-200"
                  title={p.isPinned ? "Unpin Post" : "Pin Post"}
                >
                  {p.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={() => handleAction(p.id, hidePost, p.visibility !== "PRIVATE")}
                  className="p-1.5 rounded bg-[#0d0d14] border border-white/5 text-slate-450 hover:text-slate-200"
                  title={p.visibility === "PRIVATE" ? "Unhide Post" : "Hide Post"}
                >
                  {p.visibility === "PRIVATE" ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={() => handleAction(p.id, deletePost)}
                  className="p-1.5 rounded bg-rose-950/10 border border-rose-905/20 text-rose-400 hover:bg-rose-950/30"
                  title="Purge/Delete Post"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {cursor && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => handleFetch(search, false)}
            className="px-4 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300"
            disabled={isPending}
          >
            {isPending ? "Loading..." : "Load More Content"}
          </button>
        </div>
      )}
    </div>
  );
}
