"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Plus, X, ChevronLeft, ChevronRight, Loader2, Globe, Users, Eye, Send, Archive } from "lucide-react";
import { createStory, createTextStory, markStoryViewed, getStoryViewers, archiveStory } from "@/server/actions/stories";

type StoryType = "IMAGE" | "VIDEO" | "TEXT";

interface Story {
  id: string;
  userId: string;
  mediaUrl: string | null;
  type: StoryType;
  textContent?: string | null;
  textStyle?: { bg: string; font: string; color: string } | null;
  stickers?: any[];
  audience?: string;
  createdAt?: string;
  user: {
    profile: { displayName: string; avatarUrl?: string | null; username: string };
  };
  viewed?: boolean;
  isOwn?: boolean;
}

interface StoriesProps {
  currentUser: any;
  stories?: Story[];
}

const DEMO_STORY_COLORS = [
  "from-violet-600 to-pink-500",
  "from-blue-500 to-cyan-400",
  "from-emerald-500 to-teal-400",
  "from-amber-500 to-orange-400",
  "from-rose-500 to-pink-400",
  "from-indigo-500 to-purple-400",
];

const TEXT_BG_PRESETS = [
  { label: "Violet", value: "from-violet-600 to-pink-600" },
  { label: "Blue",   value: "from-blue-600 to-cyan-500" },
  { label: "Green",  value: "from-emerald-600 to-teal-500" },
  { label: "Dark",   value: "from-zinc-900 to-zinc-800" },
  { label: "Fire",   value: "from-orange-500 to-red-600" },
  { label: "Sky",    value: "from-sky-400 to-indigo-600" },
];

const FONT_PRESETS = [
  { label: "Normal", value: "font-normal" },
  { label: "Bold",   value: "font-black" },
  { label: "Serif",  value: "font-serif" },
  { label: "Mono",   value: "font-mono" },
];

const REACTION_EMOJIS = ["❤️","🔥","😂","😮","😢","👏","🎉","💯"];

// ─── Story Viewer ─────────────────────────────────────────────────────────────
function StoryViewer({
  stories,
  startIndex,
  onClose,
}: {
  stories: Story[];
  startIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [reacted, setReacted] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DURATION = 7000;
  const TICK = 60;

  const story = stories[idx];
  if (!story) return null;

  // Mark story as viewed
  useEffect(() => {
    if (story && !story.viewed) {
      markStoryViewed(story.id);
    }
  }, [story?.id]);

  // Auto-advance timer (respects pause)
  useEffect(() => {
    if (paused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    setProgress(0);
    timerRef.current = setInterval(() => {
      setProgress(prev => {
        const next = prev + (TICK / DURATION) * 100;
        if (next >= 100) {
          clearInterval(timerRef.current!);
          setTimeout(() => {
            if (idx < stories.length - 1) setIdx(i => i + 1);
            else onClose();
          }, 80);
          return 100;
        }
        return next;
      });
    }, TICK);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [idx, paused]);

  // Keyboard nav
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [idx, onClose]);

  const goPrev = useCallback(() => { if (idx > 0) setIdx(idx - 1); }, [idx]);
  const goNext = useCallback(() => {
    if (idx < stories.length - 1) setIdx(idx + 1);
    else onClose();
  }, [idx, stories.length, onClose]);

  // Long-press to pause
  const onPressStart = () => {
    longPressRef.current = setTimeout(() => setPaused(true), 200);
  };
  const onPressEnd = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
    setPaused(false);
  };

  const handleReact = (emoji: string) => {
    setReacted(emoji);
    setTimeout(() => setReacted(null), 2000);
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    const text = replyText; setReplyText("");
    const { createDM, saveMessage } = await import("@/server/actions/messaging");
    const res = await createDM(story.userId);
    if (res?.success && res.conversation?.id) {
      await saveMessage({
        conversationId: res.conversation.id,
        content: `Replied to your story: "${text}"`,
      });
    }
  };

  const handleShowViewers = async () => {
    setShowViewers(true);
    setPaused(true);
    setViewerLoading(true);
    const res = await getStoryViewers(story.id);
    if (res.success) setViewers((res as any).viewers ?? []);
    setViewerLoading(false);
  };

  const handleArchive = async () => {
    await archiveStory(story.id);
    goNext();
  };

  const textStyle = story.textStyle;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/92 overlay-in">
      <div
        className="relative w-full max-w-sm h-full md:max-h-[88vh] md:rounded-2xl overflow-hidden shadow-2xl select-none"
        style={{ touchAction: "none" }}
      >
        {/* Segmented progress bars */}
        <div className="absolute top-3 left-3 right-3 z-20 flex gap-1">
          {stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/25 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-none"
                style={{
                  width: i < idx ? "100%" : i === idx ? `${progress}%` : "0%",
                  transition: i === idx && !paused ? `width ${TICK}ms linear` : "none",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-7 left-3 right-3 z-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 overflow-hidden border-2 border-white/40">
              {story.user.profile.avatarUrl
                ? <img src={story.user.profile.avatarUrl} className="w-full h-full object-cover" alt="" />
                : <span className="w-full h-full flex items-center justify-center text-white font-bold text-sm">{story.user.profile.displayName[0]}</span>}
            </div>
            <div>
              <p className="font-semibold text-white text-sm drop-shadow">{story.user.profile.displayName}</p>
              <p className="text-white/60 text-[11px]">{story.audience === "FOLLOWERS" ? "Followers only" : "Public"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {story.isOwn && (
              <>
                <button onClick={handleShowViewers} className="w-8 h-8 bg-black/40 rounded-full flex items-center justify-center hover:bg-black/60">
                  <Eye className="w-4 h-4 text-white" />
                </button>
                <button onClick={handleArchive} className="w-8 h-8 bg-black/40 rounded-full flex items-center justify-center hover:bg-black/60">
                  <Archive className="w-4 h-4 text-white" />
                </button>
              </>
            )}
            <button onClick={onClose} className="w-8 h-8 bg-black/40 rounded-full flex items-center justify-center hover:bg-black/60">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Media or Text */}
        <div
          className="w-full h-full"
          onMouseDown={onPressStart}
          onMouseUp={onPressEnd}
          onTouchStart={onPressStart}
          onTouchEnd={onPressEnd}
        >
          {story.type === "TEXT" ? (
            <div className={`w-full h-full bg-gradient-to-br ${textStyle?.bg ?? "from-violet-600 to-pink-600"} flex items-center justify-center p-8`}>
              <p className={`text-center ${textStyle?.font ?? "font-bold"} text-4xl leading-snug drop-shadow-lg`} style={{ color: textStyle?.color ?? "#fff" }}>
                {story.textContent}
              </p>
            </div>
          ) : story.type === "VIDEO" ? (
            <video src={story.mediaUrl ?? undefined} autoPlay muted={paused} className="w-full h-full object-contain bg-black" />
          ) : (
            <img src={story.mediaUrl ?? undefined} alt="" className="w-full h-full object-contain bg-black" />
          )}
        </div>

        {/* Tap zones */}
        <button className="absolute left-0 top-0 w-1/3 h-full z-10 cursor-pointer" onClick={goPrev} aria-label="Previous" />
        <button className="absolute right-0 top-0 w-1/3 h-full z-10 cursor-pointer" onClick={goNext} aria-label="Next" />

        {/* Reaction flash */}
        {reacted && (
          <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
            <span className="text-7xl animate-bounce drop-shadow-xl">{reacted}</span>
          </div>
        )}

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-20 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
          {/* Quick reactions */}
          {!story.isOwn && (
            <div className="flex gap-2 mb-3 justify-center">
              {REACTION_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleReact(emoji)}
                  className="text-xl hover:scale-125 transition-transform bg-black/30 rounded-full w-9 h-9 flex items-center justify-center"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          {/* Reply box */}
          {!story.isOwn && (
            <div className="flex gap-2">
              <input
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                placeholder={`Reply to ${story.user.profile.displayName}…`}
                className="flex-1 bg-white/10 border border-white/20 focus:border-violet-400 rounded-2xl px-4 py-2 text-sm text-white placeholder:text-white/50 outline-none"
              />
              <button
                onClick={handleSendReply}
                disabled={!replyText.trim()}
                className="gradient-btn w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          )}
        </div>

        {/* Arrow hints */}
        {idx > 0 && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
            <ChevronLeft className="w-6 h-6 text-white/50" />
          </div>
        )}
        {idx < stories.length - 1 && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
            <ChevronRight className="w-6 h-6 text-white/50" />
          </div>
        )}
      </div>

      {/* Viewer list panel */}
      {showViewers && (
        <div className="absolute inset-0 bg-black/80 z-30 flex items-end md:items-center justify-center" onClick={() => { setShowViewers(false); setPaused(false); }}>
          <div
            className="w-full max-w-sm bg-zinc-900 rounded-t-2xl md:rounded-2xl p-4 max-h-[60vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-zinc-100 flex items-center gap-2">
                <Eye className="w-4 h-4 text-violet-400" /> Viewers ({viewers.length})
              </p>
              <button onClick={() => { setShowViewers(false); setPaused(false); }}>
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
            {viewerLoading && <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-violet-400" /></div>}
            {!viewerLoading && viewers.length === 0 && <p className="text-zinc-500 text-sm text-center py-4">No viewers yet</p>}
            {viewers.map((v: any) => (
              <div key={v.userId} className="flex items-center gap-3 py-2.5 border-b border-zinc-800 last:border-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 overflow-hidden flex-shrink-0">
                  {v.avatarUrl
                    ? <img src={v.avatarUrl} className="w-full h-full object-cover" alt="" />
                    : <span className="w-full h-full flex items-center justify-center text-white text-xs font-bold">{v.displayName[0]}</span>}
                </div>
                <div>
                  <p className="font-semibold text-sm text-zinc-100">{v.displayName}</p>
                  <p className="text-xs text-zinc-500">@{v.username}</p>
                </div>
                <p className="ml-auto text-xs text-zinc-600">{new Date(v.viewedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Story Creator Modal ───────────────────────────────────────────────────────
function StoryCreator({
  currentUser,
  onCreated,
  onClose,
}: {
  currentUser: any;
  onCreated: (story: Story) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"pick" | "media" | "text">("pick");
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"IMAGE" | "VIDEO">("IMAGE");
  const [textContent, setTextContent] = useState("");
  const [selectedBg, setSelectedBg] = useState(TEXT_BG_PRESETS[0]?.value ?? "from-violet-600 to-pink-600");
  const [selectedFont, setSelectedFont] = useState(FONT_PRESETS[0]?.value ?? "font-normal");
  const [textColor, setTextColor] = useState("#ffffff");
  const [audience, setAudience] = useState<"PUBLIC" | "FOLLOWERS">("PUBLIC");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = file.type.startsWith("video") ? "VIDEO" : "IMAGE";
    setFileType(type);
    setPreviewUrl(URL.createObjectURL(file));
    setMode("media");
  };

  const handlePublish = async () => {
    setUploading(true);
    try {
      if (mode === "text") {
        const res = await createTextStory({
          textContent,
          textStyle: { bg: selectedBg, font: selectedFont, color: textColor },
          audience,
        });
        if (res.success && res.story) {
          onCreated({
            id: res.story.id,
            userId: res.story.userId,
            mediaUrl: null,
            type: "TEXT",
            textContent,
            textStyle: { bg: selectedBg, font: selectedFont, color: textColor },
            audience,
            user: {
              profile: {
                displayName: currentUser.name || "User",
                avatarUrl: currentUser.image || null,
                username: currentUser.username || "user",
              },
            },
            viewed: false,
            isOwn: true,
          });
          onClose();
        }
      } else if (previewUrl) {
        // Upload file then create story
        const input = fileRef.current!;
        const file = input.files?.[0];
        if (!file) return;
        const fd = new FormData();
        fd.append("file", file);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: fd }).then(r => r.json());
        if (uploadRes.success) {
          const res = await createStory({ mediaUrl: uploadRes.url, type: fileType, audience });
          if (res.success && res.story) {
            onCreated({
              id: res.story.id,
              userId: res.story.userId,
              mediaUrl: uploadRes.url,
              type: fileType,
              audience,
              user: {
                profile: {
                  displayName: currentUser.name || "User",
                  avatarUrl: currentUser.image || null,
                  username: currentUser.username || "user",
                },
              },
              viewed: false,
              isOwn: true,
            });
            onClose();
          }
        }
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 overlay-in p-4">
      <div className="relative w-full max-w-sm glass rounded-2xl border border-zinc-700 overflow-hidden shadow-2xl scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h2 className="font-bold text-zinc-100 text-sm">Create Story</h2>
          <button onClick={onClose} className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {/* Mode: pick */}
        {mode === "pick" && (
          <div className="p-5 space-y-3">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Choose story type</p>
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 transition-all text-left"
            >
              <div className="w-12 h-12 rounded-xl gradient-btn flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">📷</span>
              </div>
              <div>
                <p className="font-semibold text-zinc-100 text-sm">Photo / Video</p>
                <p className="text-xs text-zinc-500">Share a moment from your camera roll</p>
              </div>
            </button>
            <button
              onClick={() => setMode("text")}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 transition-all text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">✍️</span>
              </div>
              <div>
                <p className="font-semibold text-zinc-100 text-sm">Text Story</p>
                <p className="text-xs text-zinc-500">Share a thought with a colorful background</p>
              </div>
            </button>
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
          </div>
        )}

        {/* Mode: media preview */}
        {mode === "media" && previewUrl && (
          <div>
            <div className="relative h-64 bg-black">
              {fileType === "VIDEO"
                ? <video src={previewUrl} className="w-full h-full object-contain" controls muted />
                : <img src={previewUrl} className="w-full h-full object-contain" alt="Preview" />}
            </div>
            {/* Audience selector */}
            <div className="px-4 py-3 border-t border-zinc-800">
              <p className="text-xs text-zinc-500 mb-2">Audience</p>
              <div className="flex gap-2">
                {(["PUBLIC", "FOLLOWERS"] as const).map(a => (
                  <button
                    key={a}
                    onClick={() => setAudience(a)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${audience === a ? "gradient-btn text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
                  >
                    {a === "PUBLIC" ? <Globe className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                    {a === "PUBLIC" ? "Public" : "Followers"}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-4 pb-4 flex gap-2">
              <button onClick={() => { setMode("pick"); setPreviewUrl(null); }} className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700">
                Change
              </button>
              <button onClick={handlePublish} disabled={uploading} className="flex-1 gradient-btn py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {uploading ? "Publishing…" : "Share Story"}
              </button>
            </div>
          </div>
        )}

        {/* Mode: text story */}
        {mode === "text" && (
          <div>
            {/* Preview */}
            <div className={`h-52 bg-gradient-to-br ${selectedBg} flex items-center justify-center p-5`}>
              <p className={`text-center ${selectedFont} text-3xl leading-snug drop-shadow`} style={{ color: textColor }}>
                {textContent || "Type something…"}
              </p>
            </div>
            {/* Editor */}
            <div className="px-4 py-3 space-y-3 border-t border-zinc-800">
              <textarea
                value={textContent}
                onChange={e => setTextContent(e.target.value)}
                placeholder="Write your story text…"
                rows={2}
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-violet-500 rounded-xl px-3 py-2 text-sm text-zinc-100 outline-none resize-none"
                autoFocus
              />
              {/* Background pickers */}
              <div>
                <p className="text-xs text-zinc-500 mb-1.5">Background</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {TEXT_BG_PRESETS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setSelectedBg(p.value)}
                      className={`w-8 h-8 rounded-full bg-gradient-to-br ${p.value} flex-shrink-0 ring-2 transition-all ${selectedBg === p.value ? "ring-white scale-110" : "ring-transparent"}`}
                    />
                  ))}
                </div>
              </div>
              {/* Font pickers */}
              <div>
                <p className="text-xs text-zinc-500 mb-1.5">Font</p>
                <div className="flex gap-2 flex-wrap">
                  {FONT_PRESETS.map(f => (
                    <button
                      key={f.value}
                      onClick={() => setSelectedFont(f.value)}
                      className={`px-3 py-1 rounded-lg text-xs transition-all ${selectedFont === f.value ? "gradient-btn text-white" : "bg-zinc-800 text-zinc-400"} ${f.value}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Text color */}
              <div className="flex items-center gap-3">
                <p className="text-xs text-zinc-500">Text color</p>
                <div className="flex gap-2">
                  {["#ffffff", "#000000", "#fbbf24", "#34d399", "#f87171"].map(c => (
                    <button
                      key={c}
                      onClick={() => setTextColor(c)}
                      className={`w-6 h-6 rounded-full ring-2 transition-all ${textColor === c ? "ring-violet-400 scale-110" : "ring-transparent"}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              {/* Audience */}
              <div>
                <p className="text-xs text-zinc-500 mb-1.5">Audience</p>
                <div className="flex gap-2">
                  {(["PUBLIC", "FOLLOWERS"] as const).map(a => (
                    <button
                      key={a}
                      onClick={() => setAudience(a)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all ${audience === a ? "gradient-btn text-white" : "bg-zinc-800 text-zinc-400"}`}
                    >
                      {a === "PUBLIC" ? <Globe className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                      {a === "PUBLIC" ? "Public" : "Followers"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-4 pb-4 flex gap-2">
              <button onClick={() => setMode("pick")} className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm">Back</button>
              <button onClick={handlePublish} disabled={!textContent.trim() || uploading} className="flex-1 gradient-btn py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {uploading ? "Publishing…" : "Share Story"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stories Bar ──────────────────────────────────────────────────────────────
export default function Stories({ currentUser, stories = [] }: StoriesProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState(0);
  const [localStories, setLocalStories] = useState<Story[]>(stories);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalStories(stories); }, [stories]);

  const openStory = (index: number) => { setViewerStart(index); setViewerOpen(true); };

  const handleCreated = (story: Story) => {
    setLocalStories(prev => [story, ...prev]);
  };

  const myInitial = currentUser?.name?.[0]?.toUpperCase() ?? "U";

  return (
    <>
      {viewerOpen && localStories.length > 0 && (
        <StoryViewer
          stories={localStories}
          startIndex={viewerStart}
          onClose={() => setViewerOpen(false)}
        />
      )}
      {creatorOpen && (
        <StoryCreator
          currentUser={currentUser}
          onCreated={handleCreated}
          onClose={() => setCreatorOpen(false)}
        />
      )}

      <div className="glass-light rounded-2xl p-3 mb-3">
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "none" }}
        >
          {/* Add story card */}
          <div
            className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group"
            onClick={() => setCreatorOpen(true)}
          >
            <div className="relative w-16 h-24 rounded-2xl overflow-hidden bg-zinc-800 border border-zinc-700 group-hover:border-violet-500/50 transition-all flex items-center justify-center">
              {currentUser?.image ? (
                <img src={currentUser.image} alt="" className="w-full h-full object-cover opacity-60" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-violet-800/30 to-zinc-800">
                  <span className="text-2xl font-black text-violet-300">{myInitial}</span>
                </div>
              )}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full gradient-btn flex items-center justify-center border-2 border-zinc-900">
                <Plus className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <span className="text-[11px] text-zinc-400 font-medium text-center w-16 truncate">Your story</span>
          </div>

          {/* Stories */}
          {localStories.map((story, index) => {
            const colorIdx = index % DEMO_STORY_COLORS.length;
            const color = DEMO_STORY_COLORS[colorIdx];
            const seen = story.viewed;
            return (
              <div
                key={story.id}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group"
                onClick={() => openStory(index)}
              >
                <div className={`p-[2px] rounded-2xl transition-all ${ seen ? "bg-zinc-700" : `bg-gradient-to-br ${color}` } group-hover:scale-105`}>
                  <div className="w-16 h-24 rounded-[14px] overflow-hidden bg-zinc-800 relative">
                    {story.type === "TEXT" ? (
                      <div className={`w-full h-full bg-gradient-to-br ${story.textStyle?.bg ?? color} flex items-center justify-center p-1`}>
                        <p className={`text-center ${story.textStyle?.font ?? "font-bold"} text-xs leading-tight`} style={{ color: story.textStyle?.color ?? "#fff" }}>
                          {story.textContent?.slice(0, 40)}
                        </p>
                      </div>
                    ) : story.mediaUrl ? (
                      <img src={story.mediaUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${color} flex items-center justify-center`}>
                        <span className="text-white font-black text-xl">{story.user.profile.displayName[0]}</span>
                      </div>
                    )}
                    {/* Avatar badge */}
                    <div className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full border-2 border-white overflow-hidden">
                      {story.user.profile.avatarUrl
                        ? <img src={story.user.profile.avatarUrl} className="w-full h-full object-cover" alt="" />
                        : <div className={`w-full h-full bg-gradient-to-br ${color} flex items-center justify-center`}>
                            <span className="text-white text-[10px] font-bold">{story.user.profile.displayName[0]}</span>
                          </div>}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] text-zinc-400 font-medium text-center w-16 truncate">
                  {story.isOwn ? "Your story" : story.user.profile.displayName.split(" ")[0]}
                </span>
              </div>
            );
          })}

          {/* Placeholder ghosts when no stories */}
          {localStories.length === 0 && ["Alex", "Sam", "Jordan", "Taylor", "Casey"].map((name, i) => (
            <div key={name} className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className={`p-[2px] rounded-2xl bg-gradient-to-br ${DEMO_STORY_COLORS[i]}`}>
                <div className={`w-16 h-24 rounded-[14px] bg-gradient-to-br ${DEMO_STORY_COLORS[i]} flex items-center justify-center opacity-25`}>
                  <span className="text-white font-black text-2xl">{name[0]}</span>
                </div>
              </div>
              <span className="text-[11px] text-zinc-600 font-medium">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
