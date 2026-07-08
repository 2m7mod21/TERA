"use client";

import React, { useEffect, useState, useRef } from "react";
import { X, Loader2, UserPlus, UserCheck } from "lucide-react";
import Link from "next/link";
import { getPostReactors } from "@/server/actions/posts";
import { followUser, unfollowUser } from "@/server/actions/social";
import { playSound } from "@/lib/sounds";

interface ReactorUser {
  id: string;
  name: string;
  username: string;
  avatar?: string | null;
  isFollowing: boolean;
  reactionType: string;
}

interface ReactionsModalProps {
  postId: string;
  onClose: () => void;
}

const REACTION_EMOJIS: Record<string, string> = {
  LIKE: "👍",
  LOVE: "❤️",
  HAHA: "😂",
  WOW: "😮",
  SAD: "😢",
  ANGRY: "😡",
};

export default function ReactionsModal({ postId, onClose }: ReactionsModalProps) {
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [reactors, setReactors] = useState<ReactorUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Esc key close
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Initial load
  useEffect(() => {
    loadReactors(true);
  }, [postId, activeTab]);

  const loadReactors = async (reset = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    const currentCursor = reset ? null : cursor;
    const res = await getPostReactors(postId, activeTab, currentCursor, 15);
    
    if (res.success && res.reactors) {
      if (reset) {
        setReactors(res.reactors);
      } else {
        setReactors((prev) => [...prev, ...res.reactors!]);
      }
      setCursor(res.nextCursor || null);
      setHasMore(res.hasMore || false);

      // Sync follow status
      const newMap: Record<string, boolean> = {};
      res.reactors.forEach((r) => {
        newMap[r.id] = r.isFollowing;
      });
      setFollowingMap((prev) => ({ ...prev, ...newMap }));
    }

    setLoading(false);
    setLoadingMore(false);
  };

  const handleFollowToggle = async (userId: string) => {
    const currentlyFollowing = followingMap[userId];
    // Optimistic toggle
    setFollowingMap((prev) => ({ ...prev, [userId]: !currentlyFollowing }));
    playSound(currentlyFollowing ? "remove" : "reaction");

    const res = currentlyFollowing ? await unfollowUser(userId) : await followUser(userId);
    if (!res.success) {
      // rollback
      setFollowingMap((prev) => ({ ...prev, [userId]: currentlyFollowing }));
    }
  };

  // Static/dynamic reaction tabs based on TERA design
  const tabs = [
    { id: "ALL", label: "All" },
    { id: "LOVE", label: "❤️" },
    { id: "LIKE", label: "👍" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div 
        className="w-full max-w-sm bg-zinc-900 border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-base font-bold text-zinc-100">Reactions</h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab row */}
        <div className="flex px-4 py-2 gap-1.5 overflow-x-auto border-b border-white/[0.04]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                playSound("click");
                setActiveTab(tab.id);
              }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all shrink-0 ${
                activeTab === tab.id
                  ? "bg-violet-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
            </div>
          ) : reactors.length === 0 ? (
            <div className="text-center py-16 text-zinc-500 text-xs">
              No reactions found
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04] space-y-1">
              {reactors.map((user) => {
                const avatar = user.avatar;
                const isFollowing = followingMap[user.id] ?? false;

                return (
                  <div key={user.id} className="flex items-center justify-between py-3 group">
                    <div className="flex items-center gap-3">
                      <Link href={`/${user.username}`} onClick={onClose} className="relative block">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 overflow-hidden">
                          {avatar ? (
                            <img src={avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="w-full h-full flex items-center justify-center text-white font-bold text-xs">
                              {user.name[0]}
                            </span>
                          )}
                        </div>
                        <span className="absolute -bottom-1.5 -right-1 text-xs select-none">
                          {REACTION_EMOJIS[user.reactionType] || "👍"}
                        </span>
                      </Link>
                      <div className="min-w-0">
                        <Link 
                          href={`/${user.username}`} 
                          onClick={onClose}
                          className="text-xs font-semibold text-zinc-200 hover:text-violet-400 transition-colors block truncate"
                        >
                          {user.name}
                        </Link>
                        <span className="text-[10px] text-zinc-500 block truncate">@{user.username}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleFollowToggle(user.id)}
                      className={`text-[10px] font-bold px-2.5 py-1.5 rounded-full transition-all shrink-0 ${
                        isFollowing
                          ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700/60"
                          : "bg-violet-600 text-white hover:bg-violet-500"
                      }`}
                    >
                      {isFollowing ? (
                        <span className="flex items-center gap-1 font-semibold">
                          <UserCheck className="w-3 h-3" /> Following
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 font-bold">
                          <UserPlus className="w-3 h-3" /> Follow
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}

              {hasMore && (
                <button
                  onClick={() => loadReactors(false)}
                  disabled={loadingMore}
                  className="w-full py-2.5 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors flex justify-center items-center gap-1.5"
                >
                  {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Load More
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
