"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  followUser, unfollowUser, getOrCreateDM,
  muteUser, unmuteUser, restrictUser, unrestrictUser, reportProfile
} from "@/server/actions/social";
import { updateProfile, updateAbout, unpinPost } from "@/server/actions/profile";
import {
  MapPin, Globe, Calendar, UserCheck, UserPlus, MessageCircle,
  Edit3, Grid3X3, List, Verified, Camera, MoreHorizontal,
  Bookmark, Image as ImageIcon, Film, Users, Briefcase,
  Heart, Flag, VolumeX, Lock, Pin, PinOff,
  BookOpen, Languages, Star, GraduationCap, Lightbulb
} from "lucide-react";
import { PostCard } from "./HomeFeed";

// ─── Follow button ─────────────────────────────────────────────────────────────
function FollowButton({ targetId, initialFollowing, onToggle }: {
  targetId: string; initialFollowing: boolean; onToggle?: (f: boolean) => void;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    const prev = following;
    setLoading(true);
    setFollowing(!prev);
    if (onToggle) onToggle(!prev);
    const res = prev ? await unfollowUser(targetId) : await followUser(targetId);
    if (!res.success) {
      setFollowing(prev);
      if (onToggle) onToggle(prev);
    }
    setLoading(false);
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={following ? "Unfollow" : "Follow"}
      className={`flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm transition-all disabled:opacity-60 ${
        following
          ? "bg-zinc-800 text-zinc-300 hover:bg-rose-500/20 hover:text-rose-400 border border-zinc-700"
          : "gradient-btn text-white shadow-lg shadow-violet-500/20"
      }`}
    >
      {following ? <><UserCheck className="w-4 h-4" />Following</> : <><UserPlus className="w-4 h-4" />Follow</>}
    </button>
  );
}

// ─── Overflow menu for other profiles ─────────────────────────────────────────
function ProfileOverflowMenu({ targetId, isMuted, isRestricted }: {
  targetId: string; isMuted: boolean; isRestricted: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(isMuted);
  const [restricted, setRestricted] = useState(isRestricted);
  const [reportOpen, setReportOpen] = useState(false);

  const handleMute = async () => {
    if (muted) { await unmuteUser(targetId); setMuted(false); }
    else { await muteUser(targetId); setMuted(true); }
    setOpen(false);
  };
  const handleRestrict = async () => {
    if (restricted) { await unrestrictUser(targetId); setRestricted(false); }
    else { await restrictUser(targetId); setRestricted(true); }
    setOpen(false);
  };

  const REPORT_REASONS = ["Spam", "Fake account", "Hate speech", "Harassment", "Nudity", "Violence", "Other"];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="More options"
        className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center hover:bg-zinc-700 transition-all"
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-50 glass rounded-2xl shadow-2xl w-52 py-2 border border-zinc-800">
            <button onClick={handleMute} className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-zinc-700/50 transition-colors">
              <VolumeX className="w-4 h-4 text-zinc-400" />{muted ? "Unmute" : "Mute"} account
            </button>
            <button onClick={handleRestrict} className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-zinc-700/50 transition-colors">
              <Lock className="w-4 h-4 text-zinc-400" />{restricted ? "Unrestrict" : "Restrict"}
            </button>
            <div className="h-px bg-zinc-800 mx-3 my-1" />
            <button onClick={() => { setReportOpen(true); setOpen(false); }} className="flex items-center gap-3 w-full px-4 py-3 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors">
              <Flag className="w-4 h-4" />Report account
            </button>
          </div>
        </>
      )}

      {reportOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-sm space-y-3">
            <h3 className="font-bold text-white">Report Account</h3>
            <p className="text-zinc-400 text-sm">Why are you reporting this account?</p>
            <div className="space-y-2">
              {REPORT_REASONS.map(r => (
                <button key={r} onClick={async () => { await reportProfile(targetId, r); setReportOpen(false); }}
                  className="w-full text-left px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm transition-colors">
                  {r}
                </button>
              ))}
            </div>
            <button onClick={() => setReportOpen(false)} className="w-full py-2 rounded-xl text-zinc-500 text-sm hover:text-zinc-300">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── About section ─────────────────────────────────────────────────────────────
function AboutSection({ profile, isOwn }: { profile: any; isOwn: boolean }) {
  const [editing, setEditing] = useState(false);
  const [data, setData] = useState({
    education: (() => { try { return JSON.parse(profile.education || "[]"); } catch { return []; } })() as Array<{ school: string; degree: string; year: string }>,
    work: (() => { try { return JSON.parse(profile.work || "[]"); } catch { return []; } })() as Array<{ company: string; role: string; year: string }>,
    skills: (() => { try { return JSON.parse(profile.skills || "[]"); } catch { return []; } })() as string[],
    languages: (() => { try { return JSON.parse(profile.languages || "[]"); } catch { return []; } })() as string[],
    interests: (() => { try { return JSON.parse(profile.interests || "[]"); } catch { return []; } })() as string[],
  });
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const save = async () => {
    setSaving(true);
    await updateAbout({
      education: JSON.stringify(data.education),
      work: JSON.stringify(data.work),
      skills: JSON.stringify(data.skills),
      languages: JSON.stringify(data.languages),
      interests: JSON.stringify(data.interests),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  };

  const addEdu = () => setData(d => ({ ...d, education: [...d.education, { school: "", degree: "", year: "" }] }));
  const addWork = () => setData(d => ({ ...d, work: [...d.work, { company: "", role: "", year: "" }] }));
  const addTag = (key: "skills" | "languages" | "interests", val: string) => {
    if (!val.trim()) return;
    setData(d => ({ ...d, [key]: [...d[key], val.trim()] }));
  };
  const removeTag = (key: "skills" | "languages" | "interests", i: number) =>
    setData(d => ({ ...d, [key]: d[key].filter((_: string, idx: number) => idx !== i) }));

  const SubCard = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <div className="glass rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2 text-zinc-300 font-semibold">
        {icon}<span>{title}</span>
        {isOwn && !editing && (
          <button onClick={() => setEditing(true)} className="ml-auto text-xs text-violet-400 hover:text-violet-300">Edit</button>
        )}
      </div>
      {children}
    </div>
  );

  if (editing && isOwn) return (
    <div className="space-y-4">
      {/* Education */}
      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-zinc-300"><GraduationCap className="w-4 h-4" />Education</div>
        {data.education.map((e, i) => (
          <div key={i} className="grid grid-cols-3 gap-2">
            {(["school", "degree", "year"] as const).map(f => (
              <input key={f} placeholder={f} value={e[f]}
                onChange={ev => setData(d => ({ ...d, education: d.education.map((x, idx) => idx === i ? { ...x, [f]: ev.target.value } : x) }))}
                className="bg-zinc-900 border border-zinc-700 focus:border-violet-500 rounded-xl px-3 py-2 text-sm text-zinc-100 outline-none" />
            ))}
          </div>
        ))}
        <button onClick={addEdu} className="text-xs text-violet-400 hover:text-violet-300">+ Add Education</button>
      </div>
      {/* Work */}
      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-zinc-300"><Briefcase className="w-4 h-4" />Work</div>
        {data.work.map((e, i) => (
          <div key={i} className="grid grid-cols-3 gap-2">
            {(["company", "role", "year"] as const).map(f => (
              <input key={f} placeholder={f} value={e[f]}
                onChange={ev => setData(d => ({ ...d, work: d.work.map((x, idx) => idx === i ? { ...x, [f]: ev.target.value } : x) }))}
                className="bg-zinc-900 border border-zinc-700 focus:border-violet-500 rounded-xl px-3 py-2 text-sm text-zinc-100 outline-none" />
            ))}
          </div>
        ))}
        <button onClick={addWork} className="text-xs text-violet-400 hover:text-violet-300">+ Add Work</button>
      </div>
      {/* Tag fields */}
      {(["skills", "languages", "interests"] as const).map(key => {
        const icons: Record<string, React.ReactNode> = { skills: <Star className="w-4 h-4" />, languages: <Languages className="w-4 h-4" />, interests: <Lightbulb className="w-4 h-4" /> };
        return (
          <div key={key} className="glass rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-zinc-300 capitalize">{icons[key]}{key}</div>
            <div className="flex flex-wrap gap-2">
              {data[key].map((t: string, i: number) => (
                <span key={i} className="bg-zinc-800 text-zinc-300 text-xs px-3 py-1 rounded-full flex items-center gap-1">
                  {t}
                  <button onClick={() => removeTag(key, i)} className="text-zinc-500 hover:text-rose-400 ml-1">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input placeholder={`Add ${key}...`}
                onKeyDown={e => { if (e.key === "Enter") { addTag(key, (e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ""; } }}
                className="flex-1 bg-zinc-900 border border-zinc-700 focus:border-violet-500 rounded-xl px-3 py-2 text-sm text-zinc-100 outline-none" />
            </div>
          </div>
        );
      })}
      <div className="flex gap-3">
        <button onClick={() => setEditing(false)} className="flex-1 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-sm">Cancel</button>
        <button onClick={save} disabled={saving} className="flex-1 py-2 rounded-xl gradient-btn text-white text-sm">
          {saving ? "Saving..." : "Save About"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Bio / Location / Website */}
      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-zinc-200">About</h3>
          {isOwn && <button onClick={() => setEditing(true)} className="text-xs text-violet-400 hover:text-violet-300">Edit</button>}
        </div>
        {profile.bio && <p className="text-zinc-400 text-sm">{profile.bio}</p>}
        {profile.location && <p className="text-zinc-400 text-sm flex items-center gap-2"><MapPin className="w-4 h-4 text-violet-400" />{profile.location}</p>}
        {profile.websiteUrl && <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-violet-400 text-sm flex items-center gap-2 hover:underline"><Globe className="w-4 h-4" />{profile.websiteUrl}</a>}
        {profile.relationshipStatus && <p className="text-zinc-400 text-sm flex items-center gap-2"><Heart className="w-4 h-4 text-rose-400" />{profile.relationshipStatus}</p>}
        <p className="text-zinc-500 text-sm flex items-center gap-2"><Calendar className="w-4 h-4" />Joined {new Date(profile.user?.createdAt ?? Date.now()).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
      </div>

      {data.education.length > 0 && (
        <SubCard icon={<GraduationCap className="w-4 h-4" />} title="Education">
          {data.education.map((e, i) => (<p key={i} className="text-zinc-400 text-sm">{e.degree} — {e.school} <span className="text-zinc-600">{e.year}</span></p>))}
        </SubCard>
      )}
      {data.work.length > 0 && (
        <SubCard icon={<Briefcase className="w-4 h-4" />} title="Work">
          {data.work.map((e, i) => (<p key={i} className="text-zinc-400 text-sm">{e.role} at {e.company} <span className="text-zinc-600">{e.year}</span></p>))}
        </SubCard>
      )}
      {data.skills.length > 0 && (
        <SubCard icon={<Star className="w-4 h-4" />} title="Skills">
          <div className="flex flex-wrap gap-2">{data.skills.map((s: string, i: number) => (<span key={i} className="bg-violet-500/10 text-violet-300 text-xs px-3 py-1 rounded-full">{s}</span>))}</div>
        </SubCard>
      )}
      {data.languages.length > 0 && (
        <SubCard icon={<Languages className="w-4 h-4" />} title="Languages">
          <div className="flex flex-wrap gap-2">{data.languages.map((l: string, i: number) => (<span key={i} className="bg-blue-500/10 text-blue-300 text-xs px-3 py-1 rounded-full">{l}</span>))}</div>
        </SubCard>
      )}
      {data.interests.length > 0 && (
        <SubCard icon={<Lightbulb className="w-4 h-4" />} title="Interests">
          <div className="flex flex-wrap gap-2">{data.interests.map((t: string, i: number) => (<span key={i} className="bg-amber-500/10 text-amber-300 text-xs px-3 py-1 rounded-full">{t}</span>))}</div>
        </SubCard>
      )}

      {isOwn && data.education.length === 0 && data.work.length === 0 && data.skills.length === 0 && (
        <button onClick={() => setEditing(true)} className="w-full glass rounded-2xl p-5 text-zinc-500 text-sm hover:text-zinc-300 border-2 border-dashed border-zinc-800 hover:border-violet-500/30 transition-all">
          + Add education, work, skills, and more
        </button>
      )}
    </div>
  );
}

// ─── Pinned posts ──────────────────────────────────────────────────────────────
function PinnedPostsShelf({ posts, isOwn, currentUserId }: { posts: any[]; isOwn: boolean; currentUserId: string | null }) {
  if (posts.length === 0) return null;
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Pin className="w-3.5 h-3.5" />Pinned Posts
      </h3>
      <div className="space-y-3">
        {posts.map((post: any) => (
          <div key={post.id} className="relative">
            <div className="absolute -top-2 -right-2 z-10 bg-violet-500 rounded-full p-1">
              <Pin className="w-3 h-3 text-white" />
            </div>
            <PostCard post={post} currentUserId={currentUserId ?? ""} />
            {isOwn && (
              <button onClick={() => unpinPost(post.id)} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-rose-400 mt-1 ml-1 transition-colors">
                <PinOff className="w-3 h-3" />Unpin
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab content panels ────────────────────────────────────────────────────────
function PhotosTab({ posts }: { posts: any[] }) {
  const photos = posts.flatMap((p: any) => {
    try { return JSON.parse(p.mediaUrls || "[]") as string[]; } catch { return []; }
  }).filter(Boolean);

  if (photos.length === 0) return (
    <div className="text-center py-20 text-zinc-500 flex flex-col items-center gap-3">
      <ImageIcon className="w-12 h-12 opacity-30" /><p>No photos yet</p>
    </div>
  );

  return (
    <div className="grid grid-cols-3 gap-1">
      {photos.map((url, i) => (
        <div key={i} className="aspect-square bg-zinc-900 rounded-lg overflow-hidden">
          <img src={url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
        </div>
      ))}
    </div>
  );
}

function VideosTab({ posts }: { posts: any[] }) {
  const videos = posts.filter((p: any) => p.type === "VIDEO");
  if (videos.length === 0) return (
    <div className="text-center py-20 text-zinc-500 flex flex-col items-center gap-3">
      <Film className="w-12 h-12 opacity-30" /><p>No videos yet</p>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-2">
      {videos.map((p: any) => {
        const urls: string[] = (() => { try { return JSON.parse(p.mediaUrls || "[]"); } catch { return []; } })();
        return (
          <div key={p.id} className="aspect-video bg-zinc-900 rounded-xl overflow-hidden relative">
            {urls[0] && <video src={urls[0]} className="w-full h-full object-cover" />}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Film className="w-8 h-8 text-white/70" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FriendsTab({ followers }: { followers: any[]; following: any[] }) {
  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5">
        <h3 className="font-semibold text-zinc-200 mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-violet-400" />Followers <span className="text-zinc-500 text-sm">({followers.length})</span></h3>
        {followers.length === 0
          ? <p className="text-zinc-500 text-sm">No followers yet</p>
          : <div className="grid grid-cols-2 gap-3">
            {followers.slice(0, 10).map((f: any) => (
              <Link key={f.followerId} href={`/${f.follower?.profile?.username ?? ""}`} className="flex items-center gap-2 hover:bg-zinc-800/50 p-2 rounded-xl transition-colors">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 overflow-hidden flex-shrink-0">
                  {f.follower?.profile?.avatarUrl ? <img src={f.follower.profile.avatarUrl} className="w-full h-full object-cover" alt="" /> : <span className="w-full h-full flex items-center justify-center text-white text-xs font-bold">{f.follower?.profile?.displayName?.[0]}</span>}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{f.follower?.profile?.displayName}</p>
                  <p className="text-xs text-zinc-500 truncate">@{f.follower?.profile?.username}</p>
                </div>
              </Link>
            ))}
          </div>}
      </div>
    </div>
  );
}

// ─── Private / locked view ─────────────────────────────────────────────────────
function PrivateView({ displayName }: { displayName: string }) {
  return (
    <div className="text-center py-24 flex flex-col items-center gap-4">
      <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
        <Lock className="w-8 h-8 text-zinc-500" />
      </div>
      <div>
        <h3 className="text-white font-semibold mb-1">This account is private</h3>
        <p className="text-zinc-500 text-sm">Follow {displayName} to see their posts, photos, and more.</p>
      </div>
    </div>
  );
}

// ─── Main profile page ─────────────────────────────────────────────────────────
type Tab = "posts" | "about" | "photos" | "videos" | "friends" | "groups" | "saved" | "liked";

export default function ProfilePageClient({ data }: { data: any }) {
  const router = useRouter();
  const { profile, isFollowing, isOwnProfile, currentUserId, isMuted, isRestricted, pinnedPosts } = data;
  const user = profile.user;
  const [followerCount, setFollowerCount] = useState<number>(user.followers?.length ?? 0);
  const [tab, setTab] = useState<Tab>("posts");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<{
    displayName: string;
    bio: string;
    avatarUrl: string;
    coverUrl: string;
    websiteUrl: string;
    location: string;
    relationshipStatus: string;
  }>({
    displayName: profile.displayName,
    bio: profile.bio ?? "",
    avatarUrl: profile.avatarUrl ?? "",
    coverUrl: profile.coverUrl ?? "",
    websiteUrl: profile.websiteUrl ?? "",
    location: profile.location ?? "",
    relationshipStatus: profile.relationshipStatus ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState({ avatar: false, cover: false });

  const posts = user.posts ?? [];
  const isPrivate = profile.privacyLevel === "PRIVATE" && !isOwnProfile && !isFollowing;
  const joinDate = new Date(user.createdAt ?? Date.now()).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: "avatarUrl" | "coverUrl") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(prev => ({ ...prev, [key === "avatarUrl" ? "avatar" : "cover"]: true }));
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const d = await res.json();
      if (d.success && d.url) setEditData(prev => ({ ...prev, [key]: d.url }));
    } catch { /* ignore */ } finally {
      setUploading(prev => ({ ...prev, [key === "avatarUrl" ? "avatar" : "cover"]: false }));
    }
  };

  const handleDM = async () => {
    const res = await getOrCreateDM(profile.userId);
    if (res.success) router.push(`/messages/${res.conversationId}`);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    await updateProfile(editData);
    setSaving(false);
    setEditOpen(false);
    router.refresh();
  };

  // Tab config — hide owner-only tabs from others
  const TABS: { id: Tab; label: string; icon: React.ReactNode; ownerOnly?: boolean }[] = [
    { id: "posts", label: "Posts", icon: <Grid3X3 className="w-3.5 h-3.5" /> },
    { id: "about", label: "About", icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: "photos", label: "Photos", icon: <ImageIcon className="w-3.5 h-3.5" /> },
    { id: "videos", label: "Videos", icon: <Film className="w-3.5 h-3.5" /> },
    { id: "friends", label: "Friends", icon: <Users className="w-3.5 h-3.5" /> },
    { id: "saved", label: "Saved", icon: <Bookmark className="w-3.5 h-3.5" />, ownerOnly: true },
    { id: "liked", label: "Liked", icon: <Heart className="w-3.5 h-3.5" />, ownerOnly: true },
  ];
  const visibleTabs = TABS.filter(t => !t.ownerOnly || isOwnProfile);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Cover Photo */}
      <div className="relative h-64 md:h-80 w-full bg-gradient-to-br from-violet-900 via-purple-900 to-zinc-900 overflow-hidden">
        {profile.coverUrl && <img src={profile.coverUrl} alt="Cover" className="w-full h-full object-cover opacity-80" />}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent" />
        <Link href="/" className="absolute top-4 left-4 glass px-4 py-2 rounded-xl text-sm font-medium text-zinc-300 hover:text-white transition-colors">
          ← Back to Feed
        </Link>
        {isOwnProfile && (
          <label className="absolute top-4 right-4 glass px-3 py-2 rounded-xl text-sm text-zinc-300 hover:text-white transition-colors cursor-pointer flex items-center gap-2">
            <Camera className="w-4 h-4" />Change Cover
            <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, "coverUrl")} />
          </label>
        )}
      </div>

      {/* Profile Header */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="relative flex flex-col md:flex-row md:items-end gap-4 -mt-20 pb-6 border-b border-zinc-800">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-36 h-36 rounded-full border-4 border-zinc-950 bg-gradient-to-br from-violet-500 to-pink-500 overflow-hidden shadow-2xl">
              {profile.avatarUrl
                ? <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-5xl font-black text-white">{profile.displayName.charAt(0)}</div>}
            </div>
            {isOwnProfile && (
              <label className="absolute bottom-1 right-1 w-8 h-8 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center hover:bg-violet-600 transition-colors cursor-pointer">
                <Camera className="w-4 h-4" />
                <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, "avatarUrl")} />
              </label>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 md:pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{profile.displayName}</h1>
              {user.verifiedBadge && <Verified className="w-5 h-5 text-violet-400 fill-violet-400" />}
              {user.isAdmin && <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full font-semibold">Admin</span>}
            </div>
            <p className="text-zinc-400 text-sm">@{profile.username}</p>
            {profile.bio && <p className="text-zinc-300 mt-2 text-sm max-w-lg">{profile.bio}</p>}
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-zinc-500">
              {profile.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{profile.location}</span>}
              {profile.websiteUrl && (
                <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-violet-400 hover:underline">
                  <Globe className="w-3.5 h-3.5" />{profile.websiteUrl.replace(/^https?:\/\//, "")}
                </a>
              )}
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Joined {joinDate}</span>
            </div>

            {/* Stats */}
            <div className="flex gap-6 mt-4 text-sm">
              <div><span className="font-bold text-white">{posts.length}</span> <span className="text-zinc-500">Posts</span></div>
              <button className="hover:underline text-left">
                <span className="font-bold text-white">{followerCount}</span> <span className="text-zinc-500">Followers</span>
              </button>
              <button className="hover:underline text-left">
                <span className="font-bold text-white">{user.following?.length ?? 0}</span> <span className="text-zinc-500">Following</span>
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 md:pb-2 flex-shrink-0">
            {isOwnProfile ? (
              <button onClick={() => setEditOpen(true)}
                className="flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-all">
                <Edit3 className="w-4 h-4" />Edit Profile
              </button>
            ) : (
              <>
                <FollowButton targetId={profile.userId} initialFollowing={isFollowing}
                  onToggle={(f: boolean) => setFollowerCount((c: number) => c + (f ? 1 : -1))} />
                <button onClick={handleDM}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-all">
                  <MessageCircle className="w-4 h-4" />Message
                </button>
                <ProfileOverflowMenu targetId={profile.userId} isMuted={isMuted ?? false} isRestricted={isRestricted ?? false} />
              </>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center justify-between border-b border-zinc-800 overflow-x-auto hide-scrollbar">
          <div className="flex">
            {visibleTabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-4 text-sm font-medium transition-all border-b-2 whitespace-nowrap ${
                  tab === t.id ? "border-violet-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
          {tab === "posts" && (
            <div className="flex items-center gap-1 pr-2 flex-shrink-0">
              <button onClick={() => setViewMode("grid")} aria-label="Grid view"
                className={`p-2 rounded-lg transition-colors ${viewMode === "grid" ? "bg-violet-500/20 text-violet-400" : "text-zinc-500 hover:text-zinc-300"}`}>
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode("list")} aria-label="List view"
                className={`p-2 rounded-lg transition-colors ${viewMode === "list" ? "bg-violet-500/20 text-violet-400" : "text-zinc-500 hover:text-zinc-300"}`}>
                <List className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="py-6">
          {isPrivate && tab !== "about" ? (
            <PrivateView displayName={profile.displayName} />
          ) : tab === "posts" ? (
            <>
              <PinnedPostsShelf posts={pinnedPosts ?? []} isOwn={isOwnProfile} currentUserId={currentUserId} />
              {posts.length === 0 ? (
                <div className="text-center py-20 text-zinc-500 flex flex-col items-center gap-3">
                  <Grid3X3 className="w-12 h-12 opacity-30" />
                  <p>No posts yet</p>
                  {isOwnProfile && <Link href="/" className="text-violet-400 text-sm hover:underline">Create your first post</Link>}
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-3 gap-1">
                  {posts.map((post: any) => {
                    const media: string[] = (() => { try { return JSON.parse(post.mediaUrls || "[]"); } catch { return []; } })();
                    return (
                      <div key={post.id} className="aspect-square bg-zinc-900 rounded-lg overflow-hidden group relative cursor-pointer hover:opacity-90 transition-all">
                        {media[0]
                          ? <img src={media[0]} className="w-full h-full object-cover" alt="" />
                          : <div className="w-full h-full bg-gradient-to-tr from-violet-600/35 via-zinc-900/60 to-purple-800/40 flex flex-col justify-between p-4 border border-zinc-800">
                            <span className="text-violet-400 text-lg font-black opacity-40">"</span>
                            <p className="text-zinc-200 text-xs font-semibold line-clamp-3 text-center capitalize italic">{post.content}</p>
                            <span className="text-violet-400 text-lg font-black self-end opacity-40">"</span>
                          </div>}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-4 text-white text-sm font-semibold">
                          <span>❤️ {post.reactions?.length ?? 0}</span>
                          <span>💬 {post._count?.comments ?? 0}</span>
                        </div>
                        {post.isPinned && isOwnProfile && (
                          <div className="absolute top-2 right-2">
                            <Pin className="w-3.5 h-3.5 text-violet-400" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-4 max-w-xl mx-auto">
                  {posts.map((post: any) => <PostCard key={post.id} post={post} currentUserId={currentUserId} />)}
                </div>
              )}
            </>
          ) : tab === "about" ? (
            <div className="max-w-xl mx-auto">
              <AboutSection profile={profile} isOwn={isOwnProfile} />
            </div>
          ) : tab === "photos" ? (
            <PhotosTab posts={posts} />
          ) : tab === "videos" ? (
            <VideosTab posts={posts} />
          ) : tab === "friends" ? (
            <FriendsTab followers={user.followers ?? []} following={user.following ?? []} />
          ) : tab === "saved" ? (
            <div className="text-center py-20 text-zinc-500 flex flex-col items-center gap-3">
              <Bookmark className="w-12 h-12 opacity-30" />
              <p>Saved posts appear here</p>
              <Link href="/saved" className="text-violet-400 text-sm hover:underline">View all saved →</Link>
            </div>
          ) : tab === "liked" ? (
            <div className="text-center py-20 text-zinc-500 flex flex-col items-center gap-3">
              <Heart className="w-12 h-12 opacity-30" />
              <p>Posts you&apos;ve liked appear here</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold">Edit Profile</h2>
            {([
              { label: "Display Name", key: "displayName", type: "text" },
              { label: "Bio", key: "bio", type: "text" },
              { label: "Website", key: "websiteUrl", type: "url" },
              { label: "Location", key: "location", type: "text" },
              { label: "Relationship Status", key: "relationshipStatus", type: "text" },
            ] as const).map(({ label, key, type }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1">{label}</label>
                <input type={type} value={editData[key]}
                  onChange={e => setEditData(d => ({ ...d, [key]: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-700 focus:border-violet-500 rounded-xl px-3 py-2 text-sm text-zinc-100 outline-none" />
              </div>
            ))}

            {/* Avatar */}
            <div>
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Avatar Image</label>
              <div className="flex gap-2">
                <input type="text" placeholder="Paste URL" value={editData.avatarUrl}
                  onChange={e => setEditData(d => ({ ...d, avatarUrl: e.target.value }))}
                  className="flex-1 bg-zinc-900 border border-zinc-700 focus:border-violet-500 rounded-xl px-3 py-2 text-sm text-zinc-100 outline-none" />
                <label className="cursor-pointer gradient-btn text-white text-xs px-3 py-2 rounded-xl flex items-center font-semibold flex-shrink-0">
                  {uploading.avatar ? "Uploading..." : "Upload"}
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, "avatarUrl")} disabled={uploading.avatar} />
                </label>
              </div>
            </div>

            {/* Cover */}
            <div>
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Cover Image</label>
              <div className="flex gap-2">
                <input type="text" placeholder="Paste URL" value={editData.coverUrl}
                  onChange={e => setEditData(d => ({ ...d, coverUrl: e.target.value }))}
                  className="flex-1 bg-zinc-900 border border-zinc-700 focus:border-violet-500 rounded-xl px-3 py-2 text-sm text-zinc-100 outline-none" />
                <label className="cursor-pointer gradient-btn text-white text-xs px-3 py-2 rounded-xl flex items-center font-semibold flex-shrink-0">
                  {uploading.cover ? "Uploading..." : "Upload"}
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, "coverUrl")} disabled={uploading.cover} />
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditOpen(false)} className="flex-1 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-sm">Cancel</button>
              <button onClick={handleSaveProfile} disabled={saving} className="flex-1 py-2 rounded-xl gradient-btn text-white text-sm">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
