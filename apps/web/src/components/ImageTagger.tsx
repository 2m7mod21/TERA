"use client";

import React, { useState, useRef, useCallback } from "react";
import { TagIcon, X, Check, UserRound } from "lucide-react";
import { searchUsersForMention } from "@/server/actions/mentions";

interface ImageTag {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  x: number;  // percentage
  y: number;  // percentage
}

interface ImageTaggerProps {
  imageUrl: string;
  initialTags?: ImageTag[];
  readOnly?: boolean;
  onTagsChange?: (tags: ImageTag[]) => void;
}

export default function ImageTagger({
  imageUrl,
  initialTags = [],
  readOnly = false,
  onTagsChange,
}: ImageTaggerProps) {
  const [tags, setTags] = useState<ImageTag[]>(initialTags);
  const [pendingTag, setPendingTag] = useState<{ x: number; y: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (readOnly || !imgRef.current) return;
      const rect = imgRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setPendingTag({ x, y });
      setSearchQuery("");
      setSearchResults([]);
    },
    [readOnly]
  );

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const res = await searchUsersForMention(q);
      setSearchResults(res.users);
      setSearching(false);
    }, 200);
  }, []);

  const addTag = useCallback(
    (user: any) => {
      if (!pendingTag) return;
      const newTag: ImageTag = {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        x: pendingTag.x,
        y: pendingTag.y,
      };
      const next = tags.some((t) => t.userId === user.id)
        ? tags
        : [...tags, newTag];
      setTags(next);
      onTagsChange?.(next);
      setPendingTag(null);
      setSearchQuery("");
    },
    [pendingTag, tags, onTagsChange]
  );

  const removeTag = useCallback(
    (userId: string) => {
      const next = tags.filter((t) => t.userId !== userId);
      setTags(next);
      onTagsChange?.(next);
    },
    [tags, onTagsChange]
  );

  return (
    <div className="relative select-none">
      {/* Image container */}
      <div
        ref={imgRef}
        className={`relative overflow-hidden rounded-xl ${!readOnly ? "cursor-crosshair" : ""}`}
        onClick={handleImageClick}
      >
        <img src={imageUrl} alt="" className="w-full h-auto block" />

        {/* Existing tag dots */}
        {showTags &&
          tags.map((tag) => (
            <div
              key={tag.userId}
              className="absolute group"
              style={{ left: `${tag.x}%`, top: `${tag.y}%`, transform: "translate(-50%, -50%)" }}
            >
              {/* Dot */}
              <div className="w-5 h-5 rounded-full border-2 border-white bg-black/60 shadow-lg animate-pulse-slow" />
              {/* Label */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap bg-black/80 backdrop-blur text-white text-xs font-bold px-2 py-1 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                {tag.avatarUrl ? (
                  <img src={tag.avatarUrl} className="w-4 h-4 rounded-full object-cover" alt="" />
                ) : (
                  <UserRound className="w-3 h-3" />
                )}
                @{tag.username}
                {!readOnly && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeTag(tag.userId); }}
                    className="ml-1 text-rose-400 hover:text-rose-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}

        {/* Pending tag picker */}
        {pendingTag && (
          <div
            className="absolute"
            style={{
              left: `${pendingTag.x}%`,
              top: `${pendingTag.y}%`,
              transform: "translate(-50%, -50%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-4 h-4 rounded-full border-2 border-violet-400 bg-violet-400/30" />
            {/* Search panel */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 w-56 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-50">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
                <TagIcon className="w-3.5 h-3.5 text-violet-400" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search user..."
                  className="flex-1 bg-transparent text-xs text-zinc-100 outline-none placeholder-zinc-500"
                />
                <button
                  onClick={() => setPendingTag(null)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="max-h-36 overflow-y-auto">
                {searching && (
                  <div className="flex justify-center py-3">
                    <div className="flex gap-1">
                      {[0,1,2].map(i => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                      ))}
                    </div>
                  </div>
                )}
                {!searching && searchResults.length === 0 && searchQuery && (
                  <p className="text-xs text-zinc-500 text-center py-3">No users found</p>
                )}
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => addTag(u)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-800 transition-all text-left"
                  >
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-pink-500 flex-shrink-0 flex items-center justify-center">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <span className="text-white text-xs font-bold">{u.displayName[0]}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-zinc-100 truncate">{u.displayName}</p>
                      <p className="text-[10px] text-zinc-400 truncate">@{u.username}</p>
                    </div>
                    {tags.some(t => t.userId === u.id) && (
                      <Check className="w-3.5 h-3.5 text-emerald-400 ml-auto flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer controls */}
      {!readOnly && (
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={() => setShowTags(!showTags)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all font-medium ${
              showTags
                ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border border-zinc-700"
            }`}
          >
            <TagIcon className="w-3.5 h-3.5" />
            {showTags ? "Hide tags" : "Show tags"}
          </button>
          {tags.length > 0 && (
            <span className="text-xs text-zinc-500">
              {tags.length} {tags.length === 1 ? "person" : "people"} tagged
            </span>
          )}
          {!showTags && (
            <span className="text-[11px] text-zinc-600">Click image to tag</span>
          )}
        </div>
      )}

      {/* Read-only: tagged users list */}
      {readOnly && tags.length > 0 && (
        <button
          onClick={() => setShowTags(!showTags)}
          className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <TagIcon className="w-3.5 h-3.5" />
          {showTags ? "Hide" : `${tags.length} ${tags.length === 1 ? "person" : "people"} tagged`}
        </button>
      )}
    </div>
  );
}
