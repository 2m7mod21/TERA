"use client";
import React, { useState, useRef } from "react";
import { Image, Smile, BarChart2, Globe, Users, Lock, X, Loader2, MapPin, ShieldAlert } from "lucide-react";
import { createPost } from "@/server/actions/posts";
import MentionTextarea from "@/components/MentionTextarea";

const FEELINGS = ["😄 Happy","😢 Sad","😍 Loved","🎉 Excited","😎 Cool","😤 Frustrated","😴 Tired","🥳 Celebrating"];
const AUDIENCE_OPTIONS = [
  { value: "PUBLIC", label: "Public", icon: Globe, desc: "Anyone" },
  { value: "FRIENDS", label: "Friends", icon: Users, desc: "Followers only" },
  { value: "PRIVATE", label: "Only Me", icon: Lock, desc: "Just you" },
];

export default function PostComposer({ user }: { user: any }) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [audience, setAudience] = useState("PUBLIC");
  const [showAudience, setShowAudience] = useState(false);
  const [feeling, setFeeling] = useState("");
  const [showFeelings, setShowFeelings] = useState(false);
  const [location, setLocation] = useState("");
  const [showLocation, setShowLocation] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<string[]>([]);
  const [showPoll, setShowPoll] = useState(false);
  const [pollQ, setPollQ] = useState("");
  const [pollOpts, setPollOpts] = useState(["", ""]);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const MAX_CHARS = 2200;
  const remaining = MAX_CHARS - content.length;
  const currentAudience = AUDIENCE_OPTIONS.find(a => a.value === audience)!;

  const handleExpand = () => {
    setExpanded(true);
    setTimeout(() => textRef.current?.focus(), 50);
  };

  const handleContentChange = (val: string) => {
    setContent(val);
  };

  const handlePost = async () => {
    if (!content.trim() && mediaFiles.length === 0) return;
    setModerationError(null);
    setLoading(true);
    const hasVideo = mediaFiles.some(url => url.match(/\.(mp4|webm|ogg|mov)$/i) || url.includes("video"));
    const postType = hasVideo ? "VIDEO" : mediaFiles.length > 0 ? "IMAGE" : "TEXT";

    const postData: any = {
      type: showPoll && pollQ.trim() ? "POLL" : postType,
      content: content,
      visibility: audience,
      location: location || undefined,
      feeling: feeling || undefined,
    };
    if (mediaFiles.length > 0) postData.mediaUrls = mediaFiles;
    if (showPoll && pollQ.trim()) {
      postData.pollQuestion = pollQ;
      postData.pollOptions = pollOpts.filter(o => o.trim());
    }
    const res = await createPost(postData);
    if (res.success) {
      setContent("");
      setMediaFiles([]);
      setFeeling("");
      setLocation("");
      setShowLocation(false);
      setShowPoll(false);
      setPollQ("");
      setPollOpts(["", ""]);
      setExpanded(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else if (!res.success) {
      const errMsg = typeof res.error === "object" && res.error !== null
        ? (res.error as any).global
        : typeof res.error === "string" ? res.error : null;
      setModerationError(errMsg || "Failed to create post.");
    }
    setLoading(false);
  };

  const addPollOpt = () => { if (pollOpts.length < 5) setPollOpts([...pollOpts, ""]); };
  const removePollOpt = (i: number) => { setPollOpts(pollOpts.filter((_, j) => j !== i)); };

  const avatar = user?.image;
  const displayName = user?.name || "User";

  return (
    <div className={`glass-light rounded-2xl overflow-hidden transition-all duration-300 mb-3 ${expanded ? "shadow-lg shadow-violet-500/10" : ""}`}>
      <div className="p-3">
        {/* Top row */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0">
            {avatar ? <img src={avatar} className="w-full h-full object-cover" alt="" /> : displayName[0]}
          </div>
          <div
            className="flex-1 bg-zinc-800/60 hover:bg-zinc-800 rounded-2xl px-4 py-2.5 cursor-text transition-all border border-transparent hover:border-zinc-700"
            onClick={handleExpand}
          >
            <span className="text-zinc-500 text-sm">
              {content || (feeling ? `Feeling ${feeling}...` : `What's on your mind, ${displayName.split(" ")[0]}?`)}
            </span>
          </div>
        </div>

        {/* Expanded area */}
        {expanded && (
          <div className="mt-3 fade-in">
            {/* Audience selector */}
            <div className="relative inline-block mb-2">
              <button
                onClick={() => setShowAudience(!showAudience)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-all border border-zinc-700"
              >
                <currentAudience.icon className="w-3 h-3" />
                {currentAudience.label}
              </button>
              {showAudience && (
                <div className="absolute z-20 top-full mt-1 left-0 glass rounded-xl border border-zinc-700 shadow-xl min-w-[160px]">
                  {AUDIENCE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setAudience(opt.value); setShowAudience(false); }}
                      className={`flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-zinc-800 transition-all first:rounded-t-xl last:rounded-b-xl text-left ${audience === opt.value ? "text-violet-400" : "text-zinc-300"}`}
                    >
                      <opt.icon className="w-3.5 h-3.5" />
                      <div>
                        <span className="block font-medium">{opt.label}</span>
                        <span className="block text-xs text-zinc-500">{opt.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Feeling tag */}
            {feeling && (
              <div className="flex items-center gap-1 mb-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
                  — feeling {feeling}
                </span>
                <button onClick={() => setFeeling("")} className="text-zinc-500 hover:text-zinc-300">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Location Tag */}
            {showLocation && (
              <div className="flex items-center gap-2 mb-2 p-2 bg-zinc-800/40 rounded-xl border border-zinc-700/40 fade-in">
                <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="Where are you? (e.g. Paris, France)"
                  className="flex-1 bg-transparent text-xs text-zinc-200 outline-none placeholder-zinc-500"
                />
                {location && (
                  <button onClick={() => setLocation("")} className="text-zinc-500 hover:text-zinc-300">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Textarea with Mention Autocomplete */}
            <div className="relative">
              <MentionTextarea
                value={content}
                onChange={handleContentChange}
                placeholder={`What's on your mind, ${displayName.split(" ")[0]}?`}
                rows={expanded ? 4 : 1}
                maxLength={MAX_CHARS}
                id="post-composer-textarea"
                className="w-full bg-transparent text-zinc-100 placeholder-zinc-500 outline-none resize-none text-[15px] leading-relaxed"
              />
            </div>

            {/* Moderation error banner */}
            {moderationError && (
              <div className="flex items-start gap-2.5 mt-2 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs leading-snug animate-in fade-in slide-in-from-top-1 duration-200">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
                <div className="flex-1">
                  <p className="font-semibold text-red-300 mb-0.5">Content Policy Violation</p>
                  <p>{moderationError}</p>
                </div>
                <button onClick={() => setModerationError(null)} className="text-red-500 hover:text-red-300 mt-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Media previews */}
            {mediaFiles.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {mediaFiles.map((url, i) => {
                  const isVideo = url.match(/\.(mp4|webm|ogg|mov)$/i) || url.includes("video");
                  return (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-zinc-800">
                      {isVideo ? (
                        <video src={url} className="w-full h-full object-cover" muted loop controls />
                      ) : (
                        <img src={url} className="w-full h-full object-cover" alt="" />
                      )}
                      <button
                        onClick={() => setMediaFiles(f => f.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center p-0"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Poll builder */}
            {showPoll && (
              <div className="mt-3 space-y-2 p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                <input
                  value={pollQ}
                  onChange={e => setPollQ(e.target.value)}
                  placeholder="Ask a question..."
                  className="w-full bg-zinc-900 rounded-xl px-3 py-2 text-sm text-zinc-100 outline-none border border-zinc-700 focus:border-violet-500 transition-all"
                />
                {pollOpts.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={opt}
                      onChange={e => setPollOpts(p => p.map((o, j) => j === i ? e.target.value : o))}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 bg-zinc-900 rounded-xl px-3 py-2 text-sm text-zinc-100 outline-none border border-zinc-700 focus:border-violet-500 transition-all"
                    />
                    {pollOpts.length > 2 && (
                      <button onClick={() => removePollOpt(i)} className="text-zinc-500 hover:text-zinc-300">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                {pollOpts.length < 5 && (
                  <button onClick={addPollOpt} className="text-xs text-violet-400 hover:underline">+ Add option</button>
                )}
              </div>
            )}

            {/* Char counter */}
            <div className="flex items-center justify-between mt-2">
              <div
                className={`text-xs transition-colors ${remaining < 100 ? remaining < 20 ? "text-red-400" : "text-yellow-400" : "text-zinc-600"}`}
              >
                {remaining < 300 ? `${remaining} characters remaining` : ""}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-800/60" />

      {/* Toolbar */}
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" multiple
            onChange={async e => {
              const files = Array.from(e.target.files || []);
              for (const file of files) {
                const fd = new FormData();
                fd.append("file", file);
                const res = await fetch("/api/upload", { method: "POST", body: fd }).then(r => r.json());
                if (res.success) setMediaFiles(p => [...p, res.url]);
              }
            }}
          />
          <button
            onClick={() => { handleExpand(); fileRef.current?.click(); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-emerald-400 hover:bg-emerald-500/10 transition-all font-medium"
          >
            <Image className="w-4 h-4" />
            <span className="hidden sm:block">Photo/Video</span>
          </button>
          <button
            onClick={() => { handleExpand(); setShowFeelings(!showFeelings); }}
            className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-yellow-400 hover:bg-yellow-500/10 transition-all font-medium"
          >
            <Smile className="w-4 h-4" />
            <span className="hidden sm:block">Feeling</span>
            {showFeelings && (
              <div className="absolute bottom-full left-0 mb-2 glass rounded-2xl border border-zinc-700 p-2 grid grid-cols-2 gap-1 z-20 min-w-[200px] shadow-xl">
                {FEELINGS.map(f => (
                  <button
                    key={f}
                    onClick={(e) => { e.stopPropagation(); setFeeling(f); setShowFeelings(false); handleExpand(); }}
                    className="text-xs px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-left text-zinc-200 transition-all"
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </button>
          <button
            onClick={() => { handleExpand(); setShowLocation(!showLocation); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-pink-400 hover:bg-pink-500/10 transition-all font-medium"
          >
            <MapPin className="w-4 h-4" />
            <span className="hidden sm:block">Location</span>
          </button>
          <button
            onClick={() => { handleExpand(); setShowPoll(!showPoll); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-violet-400 hover:bg-violet-500/10 transition-all font-medium"
          >
            <BarChart2 className="w-4 h-4" />
            <span className="hidden sm:block">Poll</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {success && (
            <span className="text-xs text-emerald-400 fade-in">✓ Posted!</span>
          )}
          {expanded && (
            <button
              onClick={() => { setExpanded(false); setContent(""); setFeeling(""); setShowPoll(false); }}
              className="text-xs text-zinc-500 hover:text-zinc-300 px-3 py-2 rounded-xl hover:bg-zinc-800 transition-all"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handlePost}
            disabled={loading || (!content.trim() && mediaFiles.length === 0)}
            className="gradient-btn text-white text-sm font-semibold px-5 py-2 rounded-xl flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
