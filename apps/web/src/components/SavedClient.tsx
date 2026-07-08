"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Bookmark, FolderPlus, Folder, Trash2,
  X, Grid, FolderOpen,
} from "lucide-react";
import {
  createCollection,
  deleteCollection,
  getSavedPosts,
  unsavePost,
} from "@/server/actions/saved";
import { PostCard } from "./HomeFeed";

export default function SavedClient({
  initialCollections,
  initialPosts,
  currentUserId,
}: {
  initialCollections: any[];
  initialPosts: any[];
  currentUserId: string;
}) {
  const [collections, setCollections] = useState<any[]>(initialCollections);
  const [posts, setPosts] = useState<any[]>(initialPosts);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);

  // Modal & form states
  const [openModal, setOpenModal] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColCover, setNewColCover] = useState("");

  const [isPending, startTransition] = useTransition();

  const handleCreateCollection = () => {
    if (!newColName.trim()) return;
    startTransition(async () => {
      const res = await createCollection(newColName, newColCover);
      if (res.success && res.collection) {
        setCollections((prev) => [res.collection, ...prev]);
        setNewColName("");
        setNewColCover("");
        setOpenModal(false);
      }
    });
  };

  const handleDeleteCollection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm("Are you sure you want to delete this collection? Bookmarks will remain but collection will be removed.")) return;
    startTransition(async () => {
      const res = await deleteCollection(id);
      if (res.success) {
        setCollections((prev) => prev.filter((c) => c.id !== id));
        if (activeCollectionId === id) {
          setActiveCollectionId(null);
          // fetch all posts again
          const allPosts = await getSavedPosts();
          setPosts(allPosts);
        }
      }
    });
  };

  const handleSelectCollection = (id: string | null) => {
    setActiveCollectionId(id);
    startTransition(async () => {
      const filtered = await getSavedPosts(id || undefined);
      setPosts(filtered);
    });
  };

  const handleUnsave = async (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    await unsavePost(postId);
  };

  const activeCollectionName = activeCollectionId
    ? collections.find((c) => c.id === activeCollectionId)?.name ?? "Collection"
    : "All Bookmarks";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">← Feed</Link>
            <h1 className="text-2xl font-bold gradient-text mt-1 flex items-center gap-2">
              <Bookmark className="w-6 h-6" /> Saved Canvas
            </h1>
          </div>
          <button
            onClick={() => setOpenModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl gradient-btn text-white text-sm font-semibold shadow-md hover:shadow-violet-500/10 transition-all animate-in fade-in"
          >
            <FolderPlus className="w-4 h-4" /> Create Collection
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Collections list */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Collections</h2>
            <div className="space-y-1.5">
              <button
                onClick={() => handleSelectCollection(null)}
                className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all border ${
                  activeCollectionId === null
                    ? "border-violet-500/20 bg-violet-500/5 text-violet-300 font-semibold"
                    : "border-transparent hover:bg-zinc-900/50 text-zinc-400"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Grid className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">All Bookmarks</span>
                </div>
              </button>

              {collections.map((col) => (
                <button
                  key={col.id}
                  onClick={() => handleSelectCollection(col.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all border ${
                    activeCollectionId === col.id
                      ? "border-violet-500/20 bg-violet-500/5 text-violet-300 font-semibold"
                      : "border-transparent hover:bg-zinc-900/50 text-zinc-400"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Folder className="w-4 h-4 flex-shrink-0 text-violet-400" />
                    <span className="text-sm truncate">{col.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded-full font-bold">
                      {col._count?.bookmarks ?? 0}
                    </span>
                    <Trash2
                      onClick={(e) => handleDeleteCollection(col.id, e)}
                      className="w-3.5 h-3.5 text-zinc-650 hover:text-rose-400 transition-colors cursor-pointer"
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Main Feed of Saved Posts */}
          <div className="lg:col-span-3 space-y-4">
            <h2 className="text-sm font-bold text-zinc-400 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-violet-450" />
              {activeCollectionName}
              <span className="text-xs text-zinc-650 font-normal">({posts.length} posts)</span>
            </h2>

            {isPending ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : posts.length === 0 ? (
              <div className="glass rounded-3xl p-16 text-center text-zinc-600 border border-zinc-900/80">
                <Bookmark className="w-12 h-12 opacity-15 mx-auto mb-3" />
                <p className="font-semibold text-zinc-500">No bookmarks saved here</p>
                <p className="text-xs mt-1 max-w-xs mx-auto">
                  Click the save button on posts in your home feed to store references.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <div key={post.id} className="relative group">
                    <PostCard post={post} currentUserId={currentUserId} />
                    <button
                      onClick={() => handleUnsave(post.id)}
                      className="absolute top-4 right-14 w-8 h-8 bg-zinc-900/80 hover:bg-red-500/20 border border-zinc-800 hover:border-red-550/20 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 text-zinc-450 hover:text-rose-400 backdrop-blur"
                      title="Unsave post"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Creation Modal */}
      {openModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass border border-zinc-800 rounded-3xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-zinc-200">New Collection</h3>
              <button onClick={() => setOpenModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Collection Name</label>
                <input
                  type="text"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder="e.g. Design Inspiration, Tech, Jokes"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-violet-500 rounded-xl px-4 py-2.5 outline-none text-zinc-200 transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Cover Image URL (optional)</label>
                <input
                  type="text"
                  value={newColCover}
                  onChange={(e) => setNewColCover(e.target.value)}
                  placeholder="https://example.com/cover.jpg"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-violet-500 rounded-xl px-4 py-2.5 outline-none text-zinc-200 transition-all text-sm"
                />
              </div>
              <button
                onClick={handleCreateCollection}
                disabled={isPending || !newColName.trim()}
                className="w-full py-3 rounded-xl gradient-btn text-white font-semibold text-sm shadow-md hover:shadow-violet-500/10 disabled:opacity-50 transition-all mt-2"
              >
                {isPending ? "Creating..." : "Create Collection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
