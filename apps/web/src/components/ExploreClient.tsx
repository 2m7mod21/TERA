"use client";

import React, { useState, useEffect, useRef, useTransition, useCallback } from "react";
import Link from "next/link";
import {
  Search, UserPlus, UserCheck, TrendingUp, Hash, FileText,
  Users, X, Clock, ArrowRight, Flame, Filter, ChevronDown,
  Play, Image as ImageIcon, MessageSquare,
  Globe, Heart, Verified,
} from "lucide-react";
import { followUser, unfollowUser } from "@/server/actions/social";
import { searchAll, getSearchSuggestions } from "@/server/actions/search";
import { PostCard } from "./HomeFeed";

// ─── Local search history (sessionStorage) ───────────────────────────────────
const HISTORY_KEY = "search_history";
function getHistory(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(sessionStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { return []; }
}
function addHistory(q: string) {
  const prev = getHistory().filter((x) => x !== q).slice(0, 9);
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify([q, ...prev]));
}
function removeHistoryItem(q: string) {
  const prev = getHistory().filter((x) => x !== q);
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(prev));
}
function clearHistory() {
  sessionStorage.removeItem(HISTORY_KEY);
}

// ─── User Card ────────────────────────────────────────────────────────────────
function UserCard({ user, currentUserId }: { user: any; currentUserId: string }) {
  const [following, setFollowing] = useState(false);
  const [pending, start] = useTransition();
  const profile = user.profile || user;
  const actualUser = user.profile ? user : user.user;
  const actualUserId = user.profile ? user.id : user.userId || user.id;
  const isOwn = actualUserId === currentUserId;

  const toggle = () => start(async () => {
    const res = following ? await unfollowUser(actualUserId) : await followUser(actualUserId);
    if (res.success) setFollowing(!following);
  });

  const followerCount = actualUser?._count?.followers ?? actualUser?.followers?.length ?? 0;
  const postCount = actualUser?._count?.posts ?? 0;

  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-3 hover:border-violet-500/20 transition-all">
      <Link href={`/${profile?.username}`} className="flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 overflow-hidden relative">
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} className="w-full h-full object-cover" alt={profile.displayName} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white font-bold">{profile?.displayName?.[0] ?? "?"}</div>
          )}
        </div>
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/${profile?.username}`}>
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-sm text-zinc-100 hover:text-violet-400 transition-colors truncate">{profile?.displayName}</p>
            {actualUser?.verifiedBadge && (
              <Verified className="w-4 h-4 text-violet-400 fill-violet-400/20" title="Verified" />
            )}
          </div>
        </Link>
        <p className="text-xs text-zinc-500 truncate">@{profile?.username}</p>
        <p className="text-xs text-zinc-650 mt-0.5">{followerCount} followers · {postCount} posts</p>
      </div>
      {!isOwn && (
        <button onClick={toggle} disabled={pending}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex-shrink-0 ${
            following ? "bg-zinc-800 text-zinc-400 border border-zinc-700" : "gradient-btn text-white"
          }`}>
          {following ? <><UserCheck className="w-3.5 h-3.5" />Following</> : <><UserPlus className="w-3.5 h-3.5" />Follow</>}
        </button>
      )}
    </div>
  );
}

// ─── Group Card ───────────────────────────────────────────────────────────────
function GroupCard({ group }: { group: any }) {
  return (
    <Link href={`/groups/${group.id}`} className="glass rounded-2xl p-4 flex items-center gap-3 hover:border-violet-500/20 transition-all">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {group.coverUrl ? (
          <img src={group.coverUrl} className="w-full h-full object-cover" alt="" />
        ) : (
          <Users className="w-5 h-5 text-white" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-zinc-100 truncate">{group.name}</p>
        <p className="text-xs text-zinc-500 truncate">{group.description ?? "A Nexus group"}</p>
        <p className="text-xs text-zinc-650 mt-0.5">{group._count?.members ?? 0} members</p>
      </div>
      <ArrowRight className="w-4 h-4 text-zinc-650 flex-shrink-0" />
    </Link>
  );
}

// ─── Page Card ────────────────────────────────────────────────────────────────
function PageCard({ page }: { page: any }) {
  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-3 hover:border-violet-500/20 transition-all">
      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-pink-600 to-rose-600 flex items-center justify-center flex-shrink-0 text-white font-bold uppercase">
        {page.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-zinc-100 truncate">{page.name}</p>
        <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full mb-1">
          {page.category}
        </span>
        <p className="text-xs text-zinc-500 truncate">{page.description ?? "Official Page"}</p>
      </div>
      <button className="px-3 py-1.5 text-xs font-semibold bg-zinc-800 text-zinc-300 hover:text-white rounded-xl border border-zinc-750 transition-colors">
        Like Page
      </button>
    </div>
  );
}

// ─── Hashtag Pill ─────────────────────────────────────────────────────────────
function HashtagPill({ name, count, rank, onClick }: { name: string; count: number; rank: number; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="glass rounded-2xl p-4 text-left hover:border-violet-500/30 hover:bg-violet-500/5 transition-all w-full">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-zinc-500 mb-0.5">#{rank} trending</p>
          <p className="font-semibold text-sm text-zinc-100">#{name}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{count.toLocaleString()} posts</p>
        </div>
        <Flame className="w-4 h-4 text-orange-400 opacity-60" />
      </div>
    </button>
  );
}

// ─── Reel Card (Video grid layout) ─────────────────────────────────────────────
function ReelCard({ reel }: { reel: any }) {
  return (
    <div className="relative group aspect-[9/16] rounded-2xl overflow-hidden border border-zinc-850 hover:border-violet-500/30 bg-zinc-900 transition-all cursor-pointer">
      {reel.videoUrl && (
        <video src={reel.videoUrl} className="w-full h-full object-cover" muted loop playsInline />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-between p-3.5">
        <div className="flex justify-end">
          <div className="bg-black/45 backdrop-blur-md rounded-lg p-1.5 text-[10px] text-zinc-350 flex items-center gap-1">
            <Play className="w-3 h-3 fill-violet-400 stroke-violet-400" /> Shorts
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-white line-clamp-2 leading-relaxed">{reel.caption ?? reel.content}</p>
          <div className="flex items-center gap-2 pt-1 border-t border-white/10">
            <div className="w-5 h-5 rounded-full overflow-hidden">
              <img src={reel.user?.profile?.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50"} className="w-full h-full object-cover" alt="" />
            </div>
            <span className="text-[10px] text-zinc-300 font-semibold truncate">@{reel.user?.profile?.username}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Photo Preview Card ───────────────────────────────────────────────────────
function PhotoCard({ post }: { post: any }) {
  const images = JSON.parse(post.mediaUrls || "[]");
  const firstImage = images[0] || "";

  return (
    <div className="relative group aspect-square rounded-2xl overflow-hidden border border-zinc-850 bg-zinc-900 cursor-pointer">
      <img src={firstImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="" />
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white">
        <span className="flex items-center gap-1 text-sm font-semibold">
          <Heart className="w-4 h-4 fill-white" /> {post.reactions?.length || 0}
        </span>
        <span className="flex items-center gap-1 text-sm font-semibold">
          <MessageSquare className="w-4 h-4" /> {post._count?.comments || 0}
        </span>
      </div>
    </div>
  );
}

// ─── Tab definitions ──────────────────────────────────────────────────────────
type Tab = "top" | "users" | "posts" | "videos" | "reels" | "photos" | "hashtags" | "communities" | "pages";

export default function ExploreClient({
  suggested, currentUserId, trendingHashtags,
}: {
  suggested: any[];
  currentUserId: string;
  trendingHashtags: Array<{ id: string; name: string; count: number }>;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<{
    users: any[];
    posts: any[];
    reels: any[];
    groups: any[];
    pages: any[];
    hashtags: any[];
    comments: any[];
    stories: any[];
  } | null>(null);
  
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState<Tab>("top");
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // Advanced filters state
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<"relevant" | "recent" | "popular">("relevant");
  const [timeframe, setTimeframe] = useState<"all" | "today" | "week" | "month">("all");
  const [mediaType, setMediaType] = useState<"all" | "video" | "image" | "poll">("all");
  const [author, setAuthor] = useState<"all" | "friends">("all");

  // Autocomplete Suggestions
  const [suggestions, setSuggestions] = useState<{
    users: any[];
    hashtags: string[];
    groups: any[];
    queries: string[];
  }>({ users: [], hashtags: [], groups: [], queries: [] });
  const [showSuggestions, setShowSuggestions] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setHistory(getHistory()); }, []);

  // Debounce query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Handle autocomplete Suggestions live typing
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions({ users: [], hashtags: [], groups: [], queries: [] });
      return;
    }
    const fetchSugg = async () => {
      const resp = await getSearchSuggestions(query);
      setSuggestions(resp as any);
    };
    fetchSugg();
  }, [query]);

  // Trigger search with query + filtering metrics
  const triggerSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults(null); return; }
    setSearching(true);
    const res = await searchAll({
      query: q,
      sortBy,
      timeframe,
      mediaType,
      author,
    });
    setResults(res as any);
    setSearching(false);
  }, [sortBy, timeframe, mediaType, author]);

  useEffect(() => {
    triggerSearch(debouncedQuery);
  }, [debouncedQuery, triggerSearch]);

  const handleSelect = useCallback((q: string) => {
    setQuery(q);
    addHistory(q);
    setHistory(getHistory());
    setShowHistory(false);
    setShowSuggestions(false);
  }, []);

  const handleRemoveHistoryItem = (h: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeHistoryItem(h);
    setHistory(getHistory());
  };

  const handleClearHistory = () => { clearHistory(); setHistory([]); };

  // Calculate totals
  const totalResults = results
    ? results.users.length +
      results.posts.length +
      results.reels.length +
      results.groups.length +
      results.pages.length +
      results.hashtags.length
    : 0;

  const resultsVideos = results?.posts.filter((p) => p.type === "VIDEO") || [];
  const resultsReels = results?.reels || [];
  const resultsPhotos = results?.posts.filter((p) => p.type === "IMAGE" || p.type === "CAROUSEL") || [];

  const TABS: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "top", label: "Top", icon: TrendingUp },
    { id: "users", label: "People", icon: UserPlus, count: results?.users.length },
    { id: "posts", label: "Posts", icon: FileText, count: results?.posts.length },
    { id: "videos", label: "Videos", icon: Play, count: resultsVideos.length },
    { id: "reels", label: "Reels", icon: Play, count: resultsReels.length },
    { id: "photos", label: "Photos", icon: ImageIcon, count: resultsPhotos.length },
    { id: "hashtags", label: "Tags", icon: Hash, count: results?.hashtags.length },
    { id: "communities", label: "Groups", icon: Users, count: results?.groups.length },
    { id: "pages", label: "Pages", icon: Globe, count: results?.pages.length },
  ];

  return (
    <div className="flex-1 min-h-screen pt-4 px-3 pb-10 max-w-2xl mx-auto lg:mx-0 text-zinc-105">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">← Feed</Link>
            <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
              <Search className="w-6 h-6 text-violet-500" /> Intelligent Search
            </h1>
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-all ${
              showFilters || sortBy !== "relevant" || timeframe !== "all" || mediaType !== "all" || author !== "all"
                ? "bg-violet-600/10 border-violet-500/35 text-violet-300"
                : "border-zinc-800 bg-zinc-900/50 hover:bg-zinc-850 hover:text-white"
            }`}
          >
            <Filter className="w-4 h-4" /> Filters
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showFilters ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Filters cabinet panel */}
        {showFilters && (
          <div className="glass rounded-3xl p-5 mb-6 border border-zinc-850 animate-in fade-in slide-in-from-top-3 duration-250 grid grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* Sorting */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Sort Results By</label>
              <div className="space-y-1">
                {[
                  { id: "relevant", label: "Most Relevant" },
                  { id: "recent", label: "Most Recent" },
                  { id: "popular", label: "Most Popular" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSortBy(item.id as any)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors ${
                      sortBy === item.id ? "bg-violet-600/10 text-violet-300 font-semibold" : "hover:bg-zinc-900 text-zinc-400"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeframe */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Timeframe</label>
              <div className="space-y-1">
                {[
                  { id: "all", label: "Anytime" },
                  { id: "today", label: "Today" },
                  { id: "week", label: "This Week" },
                  { id: "month", label: "This Month" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setTimeframe(item.id as any)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors ${
                      timeframe === item.id ? "bg-violet-600/10 text-violet-300 font-semibold" : "hover:bg-zinc-900 text-zinc-400"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Media Type */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Media Format</label>
              <div className="space-y-1">
                {[
                  { id: "all", label: "All Formats" },
                  { id: "image", label: "Photos / Images" },
                  { id: "video", label: "Videos / Reels" },
                  { id: "poll", label: "Polls" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setMediaType(item.id as any)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors ${
                      mediaType === item.id ? "bg-violet-600/10 text-violet-300 font-semibold" : "hover:bg-zinc-900 text-zinc-400"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Author */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Author Source</label>
              <div className="space-y-1">
                {[
                  { id: "all", label: "Everyone" },
                  { id: "friends", label: "Following Only" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setAuthor(item.id as any)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors ${
                      author === item.id ? "bg-violet-600/10 text-violet-300 font-semibold" : "hover:bg-zinc-900 text-zinc-400"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            
          </div>
        )}

        {/* Input box */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => {
              setShowHistory(true);
              setShowSuggestions(true);
            }}
            onBlur={() => {
              // delay to click suggestions
              setTimeout(() => {
                setShowHistory(false);
                setShowSuggestions(false);
              }, 200);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim()) handleSelect(query.trim());
            }}
            placeholder="Search keywords, posts, hashtags, groups, people, pages…"
            className="w-full bg-zinc-900 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-505 rounded-2xl pl-12 pr-10 py-3.5 text-zinc-150 outline-none transition-all text-sm"
          />
          {query && (
            <button onClick={() => { setQuery(""); setResults(null); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-350 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
          {searching && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          )}

          {/* Autocomplete Suggestions & History panel */}
          {showSuggestions && query.trim() && (
            <div className="absolute top-full left-0 right-0 mt-2 z-50 glass border border-zinc-800 rounded-2xl py-2 shadow-2xl overflow-hidden max-h-[380px] overflow-y-auto">
              
              {/* Queries */}
              {suggestions.queries.length > 0 && (
                <div className="border-b border-zinc-850/60 pb-2 mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-4 py-1 flex items-center gap-1.5"><Search className="w-3 h-3" /> Search Queries</p>
                  {suggestions.queries.map((qText) => (
                    <button key={qText} onClick={() => handleSelect(qText)} className="w-full px-4 py-2 hover:bg-zinc-800/40 text-left text-sm text-zinc-300 truncate">
                      {qText}
                    </button>
                  ))}
                </div>
              )}

              {/* Users */}
              {suggestions.users.length > 0 && (
                <div className="border-b border-zinc-850/60 pb-2 mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-4 py-1 flex items-center gap-1.5"><UserPlus className="w-3 h-3" /> Members & Profiles</p>
                  {suggestions.users.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => handleSelect(profile.username)}
                      className="w-full px-4 py-2 hover:bg-zinc-800/40 text-left flex items-center gap-2"
                    >
                      <img src={profile.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50"} className="w-6 h-6 object-cover rounded-full" alt="" />
                      <div className="min-w-0">
                        <p className="text-xs text-zinc-200 font-semibold truncate">{profile.displayName}</p>
                        <p className="text-[10px] text-zinc-500 truncate">@{profile.username}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Groups */}
              {suggestions.groups.length > 0 && (
                <div className="border-b border-zinc-850/60 pb-2 mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-4 py-1 flex items-center gap-1.5"><Users className="w-3 h-3" /> Groups</p>
                  {suggestions.groups.map((group) => (
                    <button key={group.id} onClick={() => handleSelect(group.name)} className="w-full px-4 py-2 hover:bg-zinc-800/40 text-left text-xs text-zinc-305 truncate">
                      👥 {group.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Hashtags */}
              {suggestions.hashtags.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-4 py-1 flex items-center gap-1.5"><Hash className="w-3 h-3" /> Search Tags</p>
                  {suggestions.hashtags.map((tag) => (
                    <button key={tag} onClick={() => handleSelect(`#${tag}`)} className="w-full px-4 py-2 hover:bg-zinc-800/40 text-left text-xs text-zinc-305 truncate">
                      #{tag}
                    </button>
                  ))}
                </div>
              )}

            </div>
          )}

          {/* Search history dropdown */}
          {showHistory && !query.trim() && history.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 z-50 glass border border-zinc-800 rounded-2xl py-2 shadow-2xl">
              <div className="flex items-center justify-between px-4 py-1.5">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3" />Recent Searches
                </span>
                <button onClick={handleClearHistory} className="text-xs text-zinc-650 hover:text-zinc-400 transition-colors">Clear All</button>
              </div>
              {history.map((h) => (
                <div key={h} className="group/item flex items-center justify-between px-4 hover:bg-zinc-800/30 transition-colors">
                  <button onClick={() => handleSelect(h)}
                    className="flex items-center gap-3 py-2.5 text-left flex-1 min-w-0">
                    <Clock className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                    <span className="text-sm text-zinc-300 truncate">{h}</span>
                  </button>
                  <button onClick={(e) => handleRemoveHistoryItem(h, e)} className="text-zinc-600 hover:text-rose-400 opacity-0 group-hover/item:opacity-100 transition-opacity p-1">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* With matches: tab selectors */}
        {results && totalResults > 0 && (
          <div className="flex gap-1 mb-6 bg-zinc-900 p-1.5 rounded-2xl overflow-x-auto border border-zinc-850/60 no-scrollbar">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 flex-shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    tab === t.id ? "gradient-btn text-white shadow-md shadow-violet-500/10" : "text-zinc-500 hover:text-zinc-300"
                  }`}>
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                  {t.count !== undefined && t.count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${tab === t.id ? "bg-white/20" : "bg-zinc-800 text-zinc-400"}`}>
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Loading placeholder skeleton */}
        {searching && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass rounded-3xl p-5 border border-zinc-850 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-800" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-28 bg-zinc-800 rounded" />
                    <div className="h-2 w-16 bg-zinc-850 rounded" />
                  </div>
                </div>
                <div className="h-3 w-full bg-zinc-850 rounded mb-2" />
                <div className="h-3 w-3/4 bg-zinc-850 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* No results placeholder */}
        {!searching && results && totalResults === 0 && (
          <div className="text-center py-20 glass rounded-3xl border border-zinc-850/80 text-zinc-500">
            <Search className="w-12 h-12 opacity-15 mx-auto mb-3 text-violet-405" />
            <p className="font-semibold text-zinc-400">No matching results for "{query}"</p>
            <p className="text-xs mt-1 text-zinc-600 max-w-xs mx-auto">
              Double check spelling or adjust filters (timeframe, media source or authors).
            </p>
          </div>
        )}

        {/* Search contents */}
        {!searching && results && totalResults > 0 && (
          <div className="space-y-6">
            
            {/* TOP Tab */}
            {tab === "top" && (
              <div className="space-y-6">
                
                {/* Profiles section */}
                {results.users.length > 0 && (
                  <section className="space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-violet-400" /> Profiles
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {results.users.slice(0, 4).map((u: any) => (
                        <UserCard key={u.id} user={u} currentUserId={currentUserId} />
                      ))}
                    </div>
                    {results.users.length > 4 && (
                      <button onClick={() => setTab("users")} className="text-xs font-bold text-violet-400 hover:text-violet-300">
                        See all {results.users.length} profiles →
                      </button>
                    )}
                  </section>
                )}

                {/* Posts section */}
                {results.posts.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-violet-400" /> Posts
                    </h3>
                    <div className="space-y-4">
                      {results.posts.slice(0, 3).map((p: any) => (
                        <PostCard key={p.id} post={p} currentUserId={currentUserId} />
                      ))}
                    </div>
                    {results.posts.length > 3 && (
                      <button onClick={() => setTab("posts")} className="text-xs font-bold text-violet-400 hover:text-violet-300">
                        See all {results.posts.length} posts →
                      </button>
                    )}
                  </section>
                )}

                {/* Reels and videos grid */}
                {(resultsVideos.length > 0 || resultsReels.length > 0) && (
                  <section className="space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                      <Play className="w-4 h-4 text-violet-400" /> Shorts & Reels
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {resultsReels.slice(0, 4).map((r: any) => (
                        <ReelCard key={r.id} reel={r} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Groups */}
                {results.groups.length > 0 && (
                  <section className="space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-violet-400" /> Groups & Communities
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {results.groups.slice(0, 4).map((g: any) => (
                        <GroupCard key={g.id} group={g} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Pages */}
                {results.pages.length > 0 && (
                  <section className="space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-violet-400" /> Pages
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {results.pages.slice(0, 4).map((pg: any) => (
                        <PageCard key={pg.id} page={pg} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Tags */}
                {results.hashtags.length > 0 && (
                  <section className="space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                      <Hash className="w-4 h-4 text-violet-400" /> Hashtags
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {results.hashtags.slice(0, 4).map((h: any, i: number) => (
                        <HashtagPill key={h.id} name={h.name} count={h._count?.posts ?? 0} rank={i + 1}
                          onClick={() => handleSelect(`#${h.name}`)} />
                      ))}
                    </div>
                  </section>
                )}

              </div>
            )}

            {/* PEOPLE Tab */}
            {tab === "users" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.users.map((u: any) => <UserCard key={u.id} user={u} currentUserId={currentUserId} />)}
              </div>
            )}

            {/* POSTS Tab */}
            {tab === "posts" && (
              <div className="space-y-4">
                {results.posts.map((p: any) => <PostCard key={p.id} post={p} currentUserId={currentUserId} />)}
              </div>
            )}

            {/* VIDEOS Tab (Posts of type VIDEO) */}
            {tab === "videos" && (
              <div className="space-y-4">
                {resultsVideos.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-10">No videos found</p>
                ) : (
                  resultsVideos.map((p: any) => <PostCard key={p.id} post={p} currentUserId={currentUserId} />)
                )}
              </div>
            )}

            {/* REELS Tab (Model Reels) */}
            {tab === "reels" && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {resultsReels.length === 0 ? (
                  <p className="col-span-full text-sm text-zinc-500 text-center py-10">No reels found</p>
                ) : (
                  resultsReels.map((r: any) => <ReelCard key={r.id} reel={r} />)
                )}
              </div>
            )}

            {/* PHOTOS Tab (Posts with images) */}
            {tab === "photos" && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {resultsPhotos.length === 0 ? (
                  <p className="col-span-full text-sm text-zinc-500 text-center py-10">No photos found</p>
                ) : (
                  resultsPhotos.map((p: any) => <PhotoCard key={p.id} post={p} />)
                )}
              </div>
            )}

            {/* HASHTAGS Tab */}
            {tab === "hashtags" && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {results.hashtags.map((h: any, i: number) => (
                  <HashtagPill key={h.id} name={h.name} count={h._count?.posts ?? 0} rank={i + 1}
                    onClick={() => handleSelect(`#${h.name}`)} />
                ))}
              </div>
            )}

            {/* GROUPS Tab */}
            {tab === "communities" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.groups.map((g: any) => <GroupCard key={g.id} group={g} />)}
              </div>
            )}

            {/* PAGES Tab */}
            {tab === "pages" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.pages.map((pg: any) => <PageCard key={pg.id} page={pg} />)}
              </div>
            )}

          </div>
        )}

        {/* DEFAULT VIEW: Suggested + Trending topics */}
        {!searching && !results && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Suggested users */}
            <div className="md:col-span-2 space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-550 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-violet-405" /> Suggested Creators
              </h2>
              {suggested.length === 0 ? (
                <div className="glass rounded-3xl p-8 text-center text-zinc-600 border border-zinc-900">
                  No notifications or recommended accounts found.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {suggested.map((p: any) => (
                    <UserCard key={p.id ?? p.userId} user={p} currentUserId={currentUserId} />
                  ))}
                </div>
              )}
            </div>

            {/* Trending tags sidebar */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-550 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-violet-405" /> Trending Topics
              </h2>
              <div className="space-y-2">
                {trendingHashtags.map((tag, i) => (
                  <HashtagPill key={tag.id} name={tag.name} count={tag.count} rank={i + 1}
                    onClick={() => handleSelect(`#${tag.name}`)} />
                ))}
                {trendingHashtags.length === 0 && (
                  <div className="glass rounded-2xl p-4 text-zinc-600 text-sm">
                    No active trends in the last 24h.
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

    </div>
  );
}
