"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { UserPlus, UserCheck, Hash } from "lucide-react";
import { followUser } from "@/server/actions/social";

interface SuggestedUser {
  id: string;
  mutualCount: number;
  profile: { displayName: string; avatarUrl?: string | null; username: string } | null;
}

interface TrendingTopic { tag: string; count: number }
interface ActiveFriend {
  id: string;
  profile: { displayName: string; avatarUrl?: string | null; username: string } | null;
}

interface RightSidebarProps {
  suggested: SuggestedUser[];
  trending: TrendingTopic[];
  active: ActiveFriend[];
}

function SuggestCard({ user }: { user: SuggestedUser }) {
  const t = useTranslations("explore");
  const [following, setFollowing] = useState(false);
  const [pending, setPending] = useState(false);

  const follow = async () => {
    if (following || pending) return;
    setPending(true);
    const res = await followUser(user.id);
    if (res.success) setFollowing(true);
    setPending(false);
  };

  const avatar = user.profile?.avatarUrl;
  const name = user.profile?.displayName ?? "User";
  const uname = user.profile?.username ?? "";

  return (
    <div className="flex items-center gap-3 py-1.5 group">
      <Link href={`/${uname}`} className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 overflow-hidden">
          {avatar
            ? <img src={avatar} alt="" className="w-full h-full object-cover" />
            : <span className="w-full h-full flex items-center justify-center text-white font-bold">{name[0]}</span>}
        </div>
        <div className="absolute bottom-0 end-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-zinc-900" />
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/${uname}`}>
          <p className="text-sm font-semibold text-zinc-200 truncate hover:text-violet-400 transition-colors">{name}</p>
        </Link>
        <p className="text-xs text-zinc-500 truncate">
          {user.mutualCount > 0
            ? t("suggested.mutuals", { count: user.mutualCount })
            : t("suggested.suggestedForYou")}
        </p>
      </div>
      <button
        onClick={follow}
        disabled={pending || following}
        className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all flex-shrink-0 flex items-center gap-1 ${
          following
            ? "text-zinc-400 bg-zinc-800 cursor-default"
            : "text-violet-400 hover:text-white hover:bg-violet-600 bg-violet-500/15 border border-violet-500/30"
        }`}
      >
        {following
          ? <><UserCheck className="w-3 h-3" />{t("follow.following")}</>
          : <><UserPlus className="w-3 h-3" />{t("follow.follow")}</>}
      </button>
    </div>
  );
}

export default function RightSidebar({ suggested, trending, active }: RightSidebarProps) {
  const t = useTranslations("explore");

  return (
    <div className="space-y-4">
      {/* Suggested Friends */}
      {suggested.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-zinc-200 text-sm">{t("suggested.peopleYouMayKnow")}</h3>
            <Link href="/explore" className="text-xs text-violet-400 hover:underline">{t("suggested.seeAll")}</Link>
          </div>
          <div className="space-y-0.5">
            {suggested.slice(0, 5).map(u => <SuggestCard key={u.id} user={u} />)}
          </div>
        </section>
      )}

      {/* Active Friends */}
      {active.length > 0 && (
        <section>
          <h3 className="font-bold text-zinc-200 text-sm mb-3">{t("follow.activeNow")}</h3>
          <div className="space-y-2">
            {active.slice(0, 6).map((u) => {
              const name = u.profile?.displayName ?? "User";
              const uname = u.profile?.username ?? "";
              const avatar = u.profile?.avatarUrl;
              return (
                <Link key={u.id} href={`/${uname}`} className="flex items-center gap-3 py-1 group">
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 overflow-hidden">
                      {avatar
                        ? <img src={avatar} alt="" className="w-full h-full object-cover" />
                        : <span className="w-full h-full flex items-center justify-center text-white font-bold text-sm">{name[0]}</span>}
                    </div>
                    <div className="absolute bottom-0 end-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-zinc-900" />
                  </div>
                  <p className="text-sm text-zinc-300 group-hover:text-violet-400 truncate transition-colors">{name}</p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Sponsored Ad */}
      <section className="glass-light rounded-2xl p-4 border border-white/[0.04] bg-gradient-to-br from-violet-600/10 to-pink-500/10 relative overflow-hidden group">
        <div className="absolute top-0 end-0 bg-violet-500 text-[9px] text-white font-bold px-2 py-0.5 rounded-es-xl uppercase tracking-wider">
          {t("sponsored.label")}
        </div>
        <h4 className="font-bold text-zinc-100 text-xs mb-1">{t("sponsored.title")}</h4>
        <p className="text-[11px] text-zinc-400 mb-3 leading-relaxed">
          {t("sponsored.description")}
        </p>
        <button className="gradient-btn text-white text-xs font-semibold px-4 py-2 rounded-xl w-full translate-y-0 active:scale-95 transition-all">
          {t("sponsored.cta")}
        </button>
      </section>

      {/* Trending Topics */}
      {trending.length > 0 && (
        <section>
          <h3 className="font-bold text-zinc-200 text-sm mb-3">{t("trending.title")}</h3>
          <div className="space-y-2">
            {trending.map(({ tag, count }, i) => (
              <Link key={tag} href={`/explore?q=${encodeURIComponent(tag)}`} className="flex items-center gap-3 group py-1">
                <span className="text-xs text-zinc-600 w-4 text-center font-bold">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-200 group-hover:text-violet-400 transition-colors truncate">{tag}</p>
                  <p className="text-xs text-zinc-500">{t("trending.posts", { count })}</p>
                </div>
                <Hash className="w-3.5 h-3.5 text-zinc-600 group-hover:text-violet-400 transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Footer links */}
      <div className="text-[10px] text-zinc-600 space-y-1 pt-2">
        <p>{t("footer.links")}</p>
        <p>{t("footer.copyright")}</p>
      </div>
    </div>
  );
}
