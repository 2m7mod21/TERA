"use client";

import React, { useState, useRef, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { 
  Plus, X, Loader2, Users, Eye, Send, Archive, 
  Smile, Type, Palette, Sparkles, Image as ImageIcon, Star,
  MapPin
} from "lucide-react";
import { 
  createStory, createTextStory, markStoryViewed, getStoryViewers, archiveStory, 
  reactToStory 
} from "@/server/actions/stories";

type StoryType = "IMAGE" | "VIDEO" | "TEXT";

interface Story {
  id: string;
  userId: string;
  mediaUrl: string | null;
  type: StoryType;
  textContent?: string | null;
  textStyle?: { bg: string; font: string; color: string } | null;
  stickers?: StickerItem[];
  audience?: string;
  createdAt?: string;
  user: {
    profile: { displayName: string; avatarUrl?: string | null; username: string };
  };
  viewed?: boolean;
  isOwn?: boolean;
  myReaction?: string | null;
  viewCount?: number;
  expiresAt?: string;
}

interface StickerItem {
  id: string;
  type: "MENTION" | "HASHTAG" | "LOCATION" | "POLL" | "QUESTION" | "DRAWING" | "EMOJI_SLIDER";
  text?: string;
  x: number; // percentage
  y: number; // percentage
  options?: string[]; // for Polls
  votes?: Record<string, number>; // voterId -> optionIndex
  questionTitle?: string;
  answers?: { userId: string; text: string }[];
  sliderValue?: number; // 0-100 emoji slider
  dataUrl?: string; // stored base64 for drawing overlay
}

const DEMO_STORY_COLORS = [
  "from-rose-500 to-pink-500",
  "from-violet-650 to-pink-600",
  "from-blue-500 to-cyan-400",
  "from-emerald-500 to-teal-400",
  "from-amber-500 to-orange-400",
  "from-indigo-500 to-purple-400",
];

const TEXT_BG_PRESETS = [
  { label: "Noir Gradient", value: "from-zinc-950 to-zinc-800" },
  { label: "Sunset", value: "from-orange-500 to-red-650" },
  { label: "Instagram", value: "from-purple-650 via-rose-500 to-amber-500" },
  { label: "Ocean", value: "from-blue-650 to-teal-500" },
  { label: "Neon Purple", value: "from-violet-850 to-fuchsia-600" },
  { label: "Aurora", value: "from-emerald-600 via-teal-700 to-indigo-900" },
];

const FONT_PRESETS = [
  { label: "Classic", value: "font-sans font-semibold tracking-wide" },
  { label: "Elegant", value: "font-serif italic" },
  { label: "Modern", value: "font-black uppercase tracking-widest" },
  { label: "Developer", value: "font-mono text-zinc-350" },
];

const REACTION_EMOJIS = ["❤️", "🔥", "😂", "😮", "😢", "👏", "🎉", "💯"];

// ─── Story Viewer ─────────────────────────────────────────────────────────────
function StoryViewer({
  stories,
  startIndex,
  currentUser,
  onClose,
}: {
  stories: Story[];
  startIndex: number;
  currentUser: any;
  onClose: () => void;
}) {
  const t = useTranslations("feed");
  const locale = useLocale();
  const [idx, setIdx] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [reacted, setReacted] = useState<string | null>(null);
  const [localStories, setLocalStories] = useState<Story[]>(stories);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const DURATION = 6500;
  const TICK = 65;

  const story = localStories[idx];
  const isOwn = story?.userId === currentUser?.id;

  useEffect(() => {
    if (story && !story.viewed && currentUser?.id) {
      markStoryViewed(story.id);
      setLocalStories(prev => prev.map((s, i) => i === idx ? { ...s, viewed: true } : s));
    }
  }, [story?.id, idx]);

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
          if (idx < localStories.length - 1) {
            setIdx(i => i + 1);
          } else {
            onClose();
          }
          return 100;
        }
        return next;
      });
    }, TICK);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [idx, paused, localStories.length]);

  const goPrev = () => { if (idx > 0) setIdx(idx - 1); };
  const goNext = () => {
    if (idx < localStories.length - 1) setIdx(idx + 1);
    else onClose();
  };

  const handleReact = async (emoji: string) => {
    setReacted(emoji);
    if (story) {
      await reactToStory(story.id, emoji);
      setLocalStories(prev => prev.map((s, i) => i === idx ? { ...s, myReaction: emoji } : s));
    }
    setTimeout(() => setReacted(null), 1800);
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !story) return;
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

  const loadViewers = async () => {
    if (!story) return;
    setShowViewers(true);
    setPaused(true);
    setViewerLoading(true);
    const res = await getStoryViewers(story.id);
    if (res.success) setViewers(res.viewers ?? []);
    setViewerLoading(false);
  };

  const handleArchive = async () => {
    if (!story) return;
    await archiveStory(story.id);
    goNext();
  };

  const handleVote = (stickerId: string, optionIdx: number) => {
    if (!currentUser?.id || !story) return;
    setLocalStories(prev => prev.map((s, sIdx) => {
      if (sIdx !== idx) return s;
      const updatedStickers = s.stickers?.map(st => {
        if (st.id !== stickerId) return st;
        const votes = { ...st.votes, [currentUser.id]: optionIdx };
        return { ...st, votes };
      });
      return { ...s, stickers: updatedStickers };
    }));
  };

  if (!story) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 select-none animate-fade-in">
      <div className="relative w-full max-w-md h-[100dvh] md:h-full md:max-h-[85vh] md:rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between bg-zinc-950">
        
        {/* Progress header logic */}
        <div className="absolute top-4 left-4 right-4 z-50 pt-[env(safe-area-inset-top,0px)]">
          <div className="flex gap-1.5 mb-3">
            {localStories.map((_, i) => (
              <div key={i} className="flex-1 h-[3px] bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-none"
                  style={{
                    width: i < idx ? "100%" : i === idx ? `${progress}%` : "0%",
                  }}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-violet-650 to-pink-500 p-[2px]">
                <div className="w-full h-full rounded-full overflow-hidden bg-black">
                  {story.user.profile.avatarUrl ? (
                    <img src={story.user.profile.avatarUrl} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-white font-bold text-sm">
                      {story.user.profile.displayName[0]}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-start">
                <p className="font-bold text-white text-sm leading-tight drop-shadow-md">{story.user.profile.displayName}</p>
                <p className="text-white/50 text-[10px] uppercase font-bold tracking-wider">
                  {story.audience === "FOLLOWERS" ? t("stories.followers") : t("stories.public")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {isOwn && (
                <>
                  <button onClick={loadViewers} className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors">
                    <Eye className="w-4 h-4 text-white" />
                  </button>
                  <button onClick={handleArchive} className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors">
                    <Archive className="w-4 h-4 text-zinc-350" />
                  </button>
                </>
              )}
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Viewer viewport */}
        <div 
          className="relative w-full flex-1 flex items-center justify-center select-none"
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
        >
          {story.type === "TEXT" ? (
            <div className={`w-full h-full bg-gradient-to-tr ${story.textStyle?.bg ?? "from-zinc-900 to-zinc-950"} flex items-center justify-center p-8`}>
              <p className={`text-center ${story.textStyle?.font ?? "font-sans"} text-3xl leading-snug drop-shadow-md font-bold`} style={{ color: story.textStyle?.color ?? "#ffffff" }}>
                {story.textContent}
              </p>
            </div>
          ) : story.type === "VIDEO" ? (
            <video src={story.mediaUrl ?? undefined} autoPlay muted={paused} className="w-full h-full object-cover" />
          ) : (
            <img src={story.mediaUrl ?? undefined} alt="" className="w-full h-full object-cover" />
          )}

          {story.stickers?.map((st) => {
            if (st.type === "DRAWING" && st.dataUrl) {
              return (
                <img 
                  key={st.id} 
                  src={st.dataUrl} 
                  className="absolute inset-0 w-full h-full pointer-events-none object-cover z-20 animate-fade-in" 
                  alt="" 
                />
              );
            }

            return (
              <div
                key={st.id}
                className="absolute z-35 pointer-events-auto transform -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${st.x}%`, top: `${st.y}%` }}
              >
                {st.type === "MENTION" && (
                  <a href={`/${st.text}`} className="bg-white text-violet-650 font-bold px-3 py-1.5 rounded-full shadow-lg text-xs flex items-center gap-1 scale-105 active:scale-95 transition-transform">
                    <Star className="w-3.5 h-3.5 fill-violet-500 text-violet-500" />
                    @{st.text}
                  </a>
                )}

                {st.type === "HASHTAG" && (
                  <a href={`/explore?tag=${st.text}`} className="bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black px-3.5 py-1.5 rounded-full shadow-xl text-xs tracking-wider">
                    #{st.text}
                  </a>
                )}

                {st.type === "LOCATION" && (
                  <div className="bg-sky-500 text-white font-semibold px-3 py-1.5 rounded-xl shadow-lg text-xs flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-white" />
                    {st.text}
                  </div>
                )}

                {st.type === "POLL" && (
                  <div className="glass-dark border border-white/20 p-3 rounded-2xl w-48 shadow-xl text-center">
                    <p className="text-white text-xs font-bold mb-2 text-shadow">{st.text || t("stories.stickerTypes.poll")}</p>
                    <div className="flex gap-2">
                       {st.options?.map((opt, oIdx) => {
                         const votes = st.votes ?? {};
                         const total = Object.keys(votes).length;
                         const mine = currentUser?.id ? votes[currentUser.id] === oIdx : false;
                         const count = Object.values(votes).filter(v => v === oIdx).length;
                         const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

                         return (
                           <button
                             key={oIdx}
                             onClick={() => handleVote(st.id, oIdx)}
                             className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all relative overflow-hidden ${
                               mine ? "bg-white text-zinc-950" : "bg-white/10 text-white hover:bg-white/20"
                             }`}
                           >
                             {total > 0 && (
                               <div className="absolute inset-y-0 inset-inline-start-0 bg-white/20 transition-all pointer-events-none" style={{ width: `${percentage}%` }} />
                             )}
                             <span className="relative z-10">{opt} {total > 0 ? `${percentage}%` : ""}</span>
                           </button>
                         );
                       })}
                    </div>
                  </div>
                )}

                {st.type === "QUESTION" && (
                  <div className="bg-white border rounded-2xl w-48 shadow-2xl p-2.5 text-center">
                    <div className="bg-gradient-to-tr from-pink-500 to-violet-650 text-white text-[10px] font-black rounded-lg py-1 mb-2 uppercase tracking-wide">
                      {t("stories.askMeAnything")}
                    </div>
                    <p className="text-zinc-800 text-xs font-bold mb-2">{st.text || t("stories.typeSomething")}</p>
                    <input 
                      type="text" 
                      placeholder={t("stories.typeSomething")} 
                      className="w-full bg-zinc-100 text-zinc-900 placeholder:text-zinc-400 text-xs rounded-xl px-2.5 py-1.5 border-0 focus:ring-1 focus:ring-violet-500 outline-none"
                    />
                  </div>
                )}
              </div>
            );
          })}

          {reacted && (
            <div className="absolute inset-0 flex items-center justify-center z-[100] pointer-events-none">
              <span className="text-8xl animate-ping opacity-75">{reacted}</span>
            </div>
          )}
        </div>

        {/* Navigation tap overlays (localized direction-aware) */}
        <div className={`absolute inset-y-0 ${locale === 'ar' ? 'right-0' : 'left-0'} w-1/4 z-30 cursor-pointer`} onClick={goPrev} />
        <div className={`absolute inset-y-0 ${locale === 'ar' ? 'left-0' : 'right-0'} w-1/4 z-30 cursor-pointer`} onClick={goNext} />

        {/* Bottom Panel */}
        <div className="px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-4 bg-gradient-to-t from-black via-black/40 to-transparent z-40">
          {!isOwn && (
            <>
              {/* Reactions array */}
              <div className="flex gap-1.5 md:gap-2.5 justify-center flex-wrap mb-3.5">
                {REACTION_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className="text-xl md:text-2xl hover:scale-125 hover:-translate-y-1 active:scale-95 transition-all w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 backdrop-blur"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Reply field */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder={t("stories.sendReply", { username: story.user.profile.username })}
                  className="flex-1 bg-white/10 border border-white/20 focus:border-white/40 rounded-full px-4 py-2.5 text-xs text-white placeholder:text-white/40 outline-none"
                />
                <button
                  onClick={handleSendReply}
                  disabled={!replyText.trim()}
                  className="w-10 h-10 rounded-full bg-violet-650 hover:bg-violet-600 disabled:opacity-40 flex items-center justify-center transition-colors"
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </>
          )}

          {isOwn && (
            <div className="text-center text-white/50 text-[10px] uppercase font-bold tracking-widest flex items-center justify-center gap-1.5">
              <span>{t("stories.views", { count: story.viewCount ?? 0 })}</span>
              <span>•</span>
              <span>{t("stories.expiresAt", { time: new Date(story.expiresAt || "").toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}</span>
            </div>
          )}
        </div>
      </div>

      {/* Viewer Details Panel */}
      {showViewers && (
        <div className="absolute inset-0 bg-black/75 z-[400] flex items-end justify-center" onClick={() => { setShowViewers(false); setPaused(false); }}>
          <div className="w-full max-w-md bg-zinc-900 rounded-t-3xl p-5 max-h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-white text-md flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-violet-400" />
                {t("stories.viewers", { count: viewers.length })}
              </h4>
              <button onClick={() => { setShowViewers(false); setPaused(false); }} className="p-1 rounded-full bg-zinc-800 text-zinc-400"><X className="w-4 h-4" /></button>
            </div>
            {viewerLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>}
            {!viewerLoading && viewers.length === 0 && (
              <p className="text-zinc-550 text-xs text-center py-8 font-medium">{t("stories.noViewers")}</p>
            )}
            <div className="space-y-3.5">
              {viewers.map(v => (
                <div key={v.userId} className="flex items-center justify-between pb-3 border-b border-zinc-800 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-zinc-700">
                      {v.avatarUrl ? <img src={v.avatarUrl} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">{v.displayName[0]}</div>}
                    </div>
                    <div>
                      <p className="text-white text-xs font-bold">{v.displayName}</p>
                      <p className="text-zinc-450 text-[10px]">@{v.username}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-bold">{new Date(v.viewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Drawing Tools Panel ───────────────────────────────────────────────────────
function DrawCanvas({
  onSave,
  onCancel
}: {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("feed");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#a855f7"); // purple default
  const [brushSize, setBrushSize] = useState(6);
  const [brushType, setBrushType] = useState<"pen" | "neon" | "highlighter">("pen");
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.parentElement?.clientWidth || 380;
    canvas.height = canvas.parentElement?.clientHeight || 450;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    setDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.moveTo(x, y);
    ctx.beginPath();

    // Apply brush properties
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    if (brushType === "neon") {
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;
    } else if (brushType === "highlighter") {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `${color}55`; // semi transparent
      ctx.lineWidth = brushSize * 2;
    } else {
      ctx.shadowBlur = 0;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing || !ctxRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctxRef.current.lineTo(x, y);
    ctxRef.current.stroke();
  };

  const handlePointerUp = () => {
    setDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSaveAction = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL("image/png"));
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-between bg-black/80">
      <div className="flex justify-between items-center p-3 bg-zinc-950/70 backdrop-blur z-20">
        <div className="flex gap-2">
          {(["pen", "neon", "highlighter"] as const).map(brush => (
            <button
              key={brush}
              onClick={() => setBrushType(brush)}
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${
                brushType === brush ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-350 hover:bg-zinc-700"
              }`}
            >
              {t(`stories.drawing.${brush}`)}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 font-bold">
          <button onClick={handleClear} className="px-2.5 py-1 text-[10px] bg-red-650 rounded-xl text-white">{t("stories.drawing.clear")}</button>
          <button onClick={handleSaveAction} className="px-2.5 py-1 text-[10px] bg-green-500 rounded-xl text-white">{t("stories.drawing.save")}</button>
          <button onClick={onCancel} className="px-2.5 py-1 text-[10px] bg-zinc-800 rounded-xl text-white">{t("stories.drawing.cancel")}</button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full flex-1 cursor-crosshair touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      <div className="p-3 bg-zinc-950/70 flex items-center justify-between gap-3">
        <input 
          type="range" 
          min={2} 
          max={30} 
          value={brushSize} 
          onChange={e => setBrushSize(Number(e.target.value))} 
          className="flex-1 accent-violet-500" 
        />
        <div className="flex gap-1">
          {["#ef4444", "#a855f7", "#3b82f6", "#10b981", "#eab308", "#ffffff"].map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full border-2 ${color === c ? "border-white scale-110" : "border-transparent"}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Stories Component ───────────────────────────────────────────────────
export default function Stories({ currentUser, stories = [] }: { currentUser: any; stories?: Story[] }) {
  const t = useTranslations("feed");

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState(0);
  const [localStories, setLocalStories] = useState<Story[]>(stories);
  const [creatorOpen, setCreatorOpen] = useState(false);

  // Creator state
  const [createMode, setCreateMode] = useState<"pick" | "media" | "text">("pick");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"IMAGE" | "VIDEO">("IMAGE");
  const [uploading, setUploading] = useState(false);

  // Editor states
  const [textContent, setTextContent] = useState("");
  const [selectedBg, setSelectedBg] = useState<string>(TEXT_BG_PRESETS[0]?.value ?? "from-zinc-950 to-zinc-800");
  const [selectedFont, setSelectedFont] = useState<string>(FONT_PRESETS[0]?.value ?? "font-sans font-semibold tracking-wide");
  const [textColor] = useState("#ffffff");
  const [audience, setAudience] = useState<"PUBLIC" | "FOLLOWERS" | "CLOSE_FRIENDS">("PUBLIC");

  // Filters select options
  const [mediaFilter, setMediaFilter] = useState("none");
  const FILTERS = [
    { name: "Normal", value: "none" },
    { name: "B&W", value: "grayscale(100%)" },
    { name: "Warm Sepia", value: "sepia(70%)" },
    { name: "Mystic Blue", value: "contrast(110%) hue-rotate(50deg)" },
    { name: "Cosmic Glow", value: "saturate(180%) brightness(110%)" }
  ];

  // Stickers Creator
  const [stickerMode, setStickerMode] = useState<StickerItem["type"] | null>(null);
  const [stickersList, setStickersList] = useState<StickerItem[]>([]);
  const [stickerText, setStickerText] = useState("");
  const [stickerOptions, setStickerOptions] = useState<string[]>(["Yes", "No"]);
  const [drawOpen, setDrawOpen] = useState(false);

  useEffect(() => {
    setLocalStories(stories);
  }, [stories]);

  const openStory = (idx: number) => {
    setViewerStart(idx);
    setViewerOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setFileType(file.type.startsWith("video") ? "VIDEO" : "IMAGE");
    setPreviewUrl(URL.createObjectURL(file));
    setCreateMode("media");
  };

  const addSticker = () => {
    if (!stickerMode) return;
    const item: StickerItem = {
      id: crypto.randomUUID(),
      type: stickerMode,
      text: stickerText.trim(),
      x: 50,
      y: 40 + stickersList.length * 10,
    };
    if (stickerMode === "POLL") {
      item.options = stickerOptions;
    }
    setStickersList(prev => [...prev, item]);
    setStickerMode(null);
    setStickerText("");
  };

  const handleCreatorPublish = async () => {
    setUploading(true);
    try {
      if (createMode === "text") {
        const res = await createTextStory({
          textContent,
          textStyle: { bg: selectedBg, font: selectedFont, color: textColor },
          stickers: stickersList,
          audience,
        });
        if (res.success && res.story) {
          addLocalStory(res.story);
        }
      } else if (previewUrl) {
        const fd = new FormData();
        fd.append("file", selectedFile!);
        const upRes = await fetch("/api/upload", { method: "POST", body: fd }).then(r => r.json());
        if (upRes.success) {
          const res = await createStory({
            mediaUrl: upRes.url ?? "",
            type: fileType,
            stickers: stickersList,
            audience,
          });
          if (res.success && res.story) {
            addLocalStory(res.story);
          }
        }
      }
    } catch (e) {
      console.log(e);
    } finally {
      setUploading(false);
      resetCreator();
    }
  };

  const addLocalStory = (story: any) => {
    setLocalStories(prev => [
      {
        id: story.id,
        userId: story.userId,
        mediaUrl: story.mediaUrl,
        type: story.type,
        textContent: story.textContent,
        textStyle: story.textStyle ? JSON.parse(story.textStyle) : null,
        stickers: story.stickers ? JSON.parse(story.stickers) : [],
        audience: story.audience,
        createdAt: story.createdAt,
        user: {
          profile: {
            displayName: currentUser?.name ?? "User",
            avatarUrl: currentUser?.image ?? null,
            username: currentUser?.username ?? "user",
          }
        },
        viewed: false,
        isOwn: true,
      },
      ...prev
    ]);
  };

  const resetCreator = () => {
    setCreatorOpen(false);
    setCreateMode("pick");
    setSelectedFile(null);
    setPreviewUrl(null);
    setTextContent("");
    setStickersList([]);
    setMediaFilter("none");
  };

  return (
    <>
      {/* Story Viewer Overlay */}
      {viewerOpen && localStories.length > 0 && (
        <StoryViewer
          stories={localStories}
          startIndex={viewerStart}
          currentUser={currentUser}
          onClose={() => setViewerOpen(false)}
        />
      )}

      {/* Main Tray Container */}
      <div className="glass-light rounded-3xl p-4 shadow-xl border border-white/[0.04]">
        <div className="flex gap-3.5 overflow-x-auto pb-1 hide-scrollbar" style={{ scrollbarWidth: "none" }}>
          
          {/* Add story Card */}
          <div 
            onClick={() => setCreatorOpen(true)}
            className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer group"
          >
            <div className="relative w-16 h-16 rounded-full bg-zinc-900 border-2 border-dashed border-zinc-700 hover:border-violet-500 flex items-center justify-center p-[2px] transition-all group-hover:scale-105 active:scale-95">
              <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-zinc-950">
                {currentUser?.image ? (
                  <img src={currentUser.image} alt="" className="w-full h-full object-cover" loading="eager" />
                ) : (
                  <span className="text-xl font-black text-violet-400">{currentUser?.name?.[0] ?? "U"}</span>
                )}
              </div>
              <div className="absolute -bottom-1 -end-1 w-5 h-5 rounded-full bg-violet-600 border-2 border-zinc-950 flex items-center justify-center">
                <Plus className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <span className="text-[11px] text-zinc-400 font-bold select-none truncate w-16 text-center">{t("stories.yourStory")}</span>
          </div>

          {/* Map Stories */}
          {localStories.map((story, i) => {
            const indexColor = i % DEMO_STORY_COLORS.length;
            const gradient = DEMO_STORY_COLORS[indexColor];
            const seen = story.viewed;

            return (
              <div
                key={story.id}
                onClick={() => openStory(i)}
                className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer group animate-fade-in"
              >
                <div 
                  className={`p-[3px] rounded-full transition-all group-hover:scale-105 active:scale-95 ${
                    seen ? "bg-zinc-800" : `bg-gradient-to-tr ${gradient}`
                  }`}
                >
                  <div className="w-16 h-16 rounded-full overflow-hidden p-[2.5px] bg-zinc-950">
                    <div className="w-full h-full rounded-full overflow-hidden bg-zinc-900">
                      {story.user.profile.avatarUrl ? (
                        <img src={story.user.profile.avatarUrl} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-tr ${gradient} flex items-center justify-center`}>
                          <span className="text-white font-extrabold text-sm">{story.user.profile.displayName[0]}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] text-zinc-450 font-bold tracking-tight truncate w-16 text-center">
                  {story.isOwn ? t("stories.yourStoryAuthor") : story.user.profile.displayName.split(" ")[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Story Creator Modal */}
      {creatorOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/92 backdrop-blur p-4 select-none animate-fade-in">
          <div className="relative w-full max-w-sm glass rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl scale-in flex flex-col justify-between max-h-[90dvh] bg-zinc-950">
            
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3.5 border-b border-zinc-900 bg-zinc-950/50 backdrop-blur">
              <h3 className="font-extrabold text-white text-sm tracking-wide uppercase">{t("stories.newStory")}</h3>
              <button onClick={resetCreator} className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-850 flex items-center justify-center text-zinc-450 transition-colors"><X className="w-4 h-4" /></button>
            </div>

            {/* Viewport content */}
            <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center min-h-[350px]">
              
              {createMode === "pick" && (
                <div className="p-6 w-full space-y-4">
                  <button 
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*,video/*";
                      input.onchange = (e: any) => handleFileChange(e);
                      input.click();
                    }}
                    className="w-full flex items-center gap-4 p-5 rounded-2xl bg-zinc-900/60 border border-zinc-850 hover:bg-zinc-850 transition-all text-start group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform"><ImageIcon className="w-5 h-5 text-white" /></div>
                    <div>
                      <h5 className="font-bold text-white text-sm">{t("stories.mediaStory.title")}</h5>
                      <p className="text-zinc-550 text-xs mt-0.5">{t("stories.mediaStory.desc")}</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => setCreateMode("text")}
                    className="w-full flex items-center gap-4 p-5 rounded-2xl bg-zinc-900/60 border border-zinc-850 hover:bg-zinc-850 transition-all text-start group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-pink-650 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform"><Type className="w-5 h-5 text-white" /></div>
                    <div>
                      <h5 className="font-bold text-white text-sm">{t("stories.textStory.title")}</h5>
                      <p className="text-zinc-550 text-xs mt-0.5">{t("stories.textStory.desc")}</p>
                    </div>
                  </button>
                </div>
              )}

              {/* Text mode input preview */}
              {createMode === "text" && (
                <div className={`w-full h-full bg-gradient-to-tr ${selectedBg} flex flex-col justify-center items-center p-6 text-center select-none`}>
                  <textarea
                    value={textContent}
                    onChange={e => setTextContent(e.target.value)}
                    placeholder={t("stories.typeWords")}
                    className={`bg-transparent border-0 text-3xl font-bold leading-normal outline-none text-center resize-none w-full max-h-48 tracking-wide drop-shadow-md placeholder:text-white/40 ${selectedFont}`}
                    style={{ color: textColor }}
                    rows={4}
                    autoFocus
                  />
                </div>
              )}

              {/* Media mode render preview */}
              {createMode === "media" && previewUrl && (
                <div className="relative w-full h-full flex items-center justify-center">
                  {fileType === "VIDEO" ? (
                    <video src={previewUrl} className="w-full h-full object-cover" style={{ filter: mediaFilter }} autoPlay loop muted />
                  ) : (
                    <img src={previewUrl} className="w-full h-full object-cover" style={{ filter: mediaFilter }} alt="" />
                  )}

                  {/* Draw canvas Overlay Component */}
                  {drawOpen && (
                    <DrawCanvas 
                      onSave={(dataUrl) => {
                        const newSticker: StickerItem = {
                          id: crypto.randomUUID(),
                          type: "DRAWING",
                          dataUrl,
                          x: 50,
                          y: 50
                        };
                        setStickersList(prev => [...prev, newSticker]);
                        setDrawOpen(false);
                      }} 
                      onCancel={() => setDrawOpen(false)} 
                    />
                  )}

                  {/* Added stickers list displaying in preview */}
                  {stickersList.map(st => {
                    if (st.type === "DRAWING" && st.dataUrl) {
                      return <img key={st.id} src={st.dataUrl} className="absolute inset-0 w-full h-full pointer-events-none object-cover z-25" alt="" />;
                    }

                    return (
                      <div 
                        key={st.id} 
                        className="absolute cursor-move select-none p-2 border border-dashed border-white/20 hover:border-white/50 rounded-xl"
                        style={{ left: `${st.x}%`, top: `${st.y}%`, transform: "translate(-50%, -50%)" }}
                      >
                        <div className="relative">
                          <button 
                            className="absolute -top-3.5 -end-3.5 w-5 h-5 rounded-full bg-red-650 text-white flex items-center justify-center font-bold text-[9px]"
                            onClick={() => setStickersList(p => p.filter(x => x.id !== st.id))}
                          >
                            ×
                          </button>
                          
                          {st.type === "MENTION" && (
                            <span className="bg-white text-violet-500 font-bold px-2.5 py-1 rounded-full text-xs shadow-lg">@{st.text}</span>
                          )}

                          {st.type === "HASHTAG" && (
                            <span className="bg-gradient-to-r from-pink-500 to-rose-500 text-white font-extrabold px-3 py-1 rounded-full text-xs shadow-lg">#{st.text}</span>
                          )}

                          {st.type === "LOCATION" && (
                            <span className="bg-sky-500 text-white font-bold px-3 py-1 rounded-full text-xs shadow-lg flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {st.text}</span>
                          )}

                          {st.type === "POLL" && (
                            <div className="glass-dark border border-white/20 p-2.5 rounded-2xl w-40 text-center shadow-2xl">
                              <p className="text-white text-[11px] font-bold mb-1.5">{st.text || t("stories.stickerTypes.poll")}</p>
                              <div className="flex gap-1">
                                {st.options?.map((o, idx) => (
                                  <span key={idx} className="flex-1 bg-white/20 text-white font-bold rounded-lg py-1 text-[9px]">{o}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {st.type === "QUESTION" && (
                            <div className="bg-white border rounded-xl w-36 shadow-lg p-2 text-center text-zinc-900">
                              <span className="bg-violet-650 text-white font-black text-[8px] rounded px-1 py-0.5 uppercase tracking-wider block mb-1">{t("stories.stickerTypes.question")}</span>
                              <p className="text-[10px] font-bold">{st.text || t("stories.placeholder.location")}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Custom Interactive Tool bars per mode */}
            {createMode !== "pick" && (
              <div className="p-3 bg-zinc-950 border-t border-zinc-900 space-y-3">
                
                {/* Media toolbar selectors */}
                {createMode === "media" && (
                  <div className="flex justify-between items-center gap-2">
                    <button 
                      onClick={() => setDrawOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-[10px] uppercase font-bold text-zinc-100 transition-all"
                    >
                      <Palette className="w-4 h-4 text-pink-400" />
                      <span>{t("stories.draw")}</span>
                    </button>

                    <button 
                      onClick={() => {
                        setStickerMode("MENTION");
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-[10px] uppercase font-bold text-zinc-100 transition-all"
                    >
                      <Smile className="w-4 h-4 text-emerald-400" />
                      <span>{t("stories.sticker")}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <select 
                        value={mediaFilter} 
                        onChange={e => setMediaFilter(e.target.value)}
                        className="bg-zinc-900 border border-zinc-800 text-white text-[10px] rounded-lg px-2 py-1.5 outline-none font-bold"
                      >
                        {FILTERS.map(f => (
                          <option key={f.name} value={f.value}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Text toolbar adjustments */}
                {createMode === "text" && (
                  <div className="space-y-2">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {TEXT_BG_PRESETS.map(p => (
                        <button
                          key={p.value}
                          onClick={() => setSelectedBg(p.value)}
                          className={`w-7 h-7 rounded-full bg-gradient-to-tr ${p.value} ring-2 transition-all flex-shrink-0 ${
                            selectedBg === p.value ? "ring-white scale-110" : "ring-transparent"
                          }`}
                        />
                      ))}
                    </div>

                    <div className="flex gap-1.5">
                      {FONT_PRESETS.map(f => (
                        <button
                          key={f.value}
                          onClick={() => setSelectedFont(f.value)}
                          className={`px-3 py-1 rounded-xl text-[10px] font-bold uppercase transition-all flex-1 ${
                            selectedFont === f.value ? "bg-white text-zinc-950" : "bg-zinc-900 hover:bg-zinc-850 text-zinc-400"
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sticker builder modal overlay */}
                {stickerMode && (
                  <div className="absolute inset-0 bg-black/90 z-[120] flex items-center justify-center p-4">
                    <div className="w-full max-w-[280px] bg-zinc-900 border border-zinc-800 rounded-3xl p-4 text-center">
                      <p className="text-zinc-550 text-[10px] font-black uppercase tracking-wider mb-3">{t("stories.addSticker")}</p>
                      
                      <div className="flex gap-1.5 mb-3.5">
                        {(["MENTION", "HASHTAG", "LOCATION", "POLL", "QUESTION"] as const).map(stickerType => (
                          <button
                            key={stickerType}
                            onClick={() => setStickerMode(stickerType)}
                            className={`px-2 py-1 rounded-xl text-[8px] font-black uppercase flex-1 ${stickerMode === stickerType ? "bg-white text-zinc-950" : "bg-zinc-800 text-zinc-350"}`}
                          >
                            {t(`stories.stickerTypes.${stickerType.toLowerCase() as any}`)}
                          </button>
                        ))}
                      </div>

                      {stickerMode === "POLL" ? (
                        <div className="space-y-2 mb-3">
                          <input 
                            type="text" 
                            placeholder={t("stories.placeholder.poll")} 
                            value={stickerText} 
                            onChange={e => setStickerText(e.target.value)}
                            className="w-full bg-zinc-800 text-white rounded-xl px-2.5 py-1.5 text-xs outline-none"
                          />
                          <div className="flex gap-1.5">
                            <input 
                              type="text" 
                              value={stickerOptions[0] ?? ""} 
                              onChange={e => setStickerOptions([e.target.value, stickerOptions[1] ?? ""])}
                              className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1 text-[10px] text-center"
                            />
                            <input 
                              type="text" 
                              value={stickerOptions[1] ?? ""} 
                              onChange={e => setStickerOptions([stickerOptions[0] ?? "", e.target.value])}
                              className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1 text-[10px] text-center"
                            />
                          </div>
                        </div>
                      ) : (
                        <input 
                          type="text" 
                          placeholder={
                            stickerMode === "MENTION" 
                            ? t("stories.placeholder.username") 
                            : stickerMode === "HASHTAG" 
                            ? t("stories.placeholder.hashtag") 
                            : t("stories.placeholder.location")
                          } 
                          value={stickerText}
                          onChange={e => setStickerText(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-3 py-2 text-xs outline-none mb-3"
                          autoFocus
                        />
                      )}

                      <div className="flex gap-2 font-bold">
                        <button onClick={() => setStickerMode(null)} className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-850 text-white rounded-xl text-xs">{t("stories.close")}</button>
                        <button onClick={addSticker} className="flex-1 py-1.5 bg-violet-650 hover:bg-violet-600 text-white rounded-xl text-xs">{t("stories.add")}</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Privacy setup tray */}
                <div className="flex items-center justify-between border-t border-zinc-900 pt-3">
                  <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest flex items-center gap-1"><Users className="w-3.5 h-3.5 text-zinc-450" /> {t("stories.audience")}</span>
                  <div className="flex gap-1 font-bold">
                    {(["PUBLIC", "FOLLOWERS"] as const).map(a => (
                      <button
                        key={a}
                        onClick={() => setAudience(a)}
                        className={`px-2.5 py-1 rounded-lg text-[9px] transition-all ${
                          audience === a ? "bg-white text-zinc-950" : "bg-zinc-900 text-zinc-450"
                        }`}
                      >
                        {t(`stories.${a.toLowerCase() as any}`)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit actions bottom panel */}
                <div className="flex gap-2 border-t border-zinc-900 pt-3 bg-zinc-950 font-bold">
                  <button 
                    onClick={() => {
                      if (createMode === "text" || !previewUrl) {
                        setCreateMode("pick");
                      } else {
                        setPreviewUrl(null);
                        setCreateMode("pick");
                      }
                    }} 
                    className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-350 text-xs transition-all"
                  >
                    {t("stories.back")}
                  </button>
                  <button 
                    onClick={handleCreatorPublish} 
                    disabled={uploading || (createMode === "text" && !textContent.trim())} 
                    className="flex-1 gradient-btn py-2.5 rounded-xl text-white text-xs disabled:opacity-40 flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-xl"
                  >
                    {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{uploading ? t("stories.publishing") : t("stories.publish")}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
