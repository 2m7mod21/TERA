import React from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/server/auth/config";
import { getSuggestedUsers, getTrendingTopics, getActiveFriends } from "@/server/actions/feed";
import { getUnreadCount } from "@/server/actions/notifications";
import TopNav from "@/components/TopNav";
import RightSidebar from "@/components/RightSidebar";
import {
  Home, MessageCircle, Bell, Film, Bookmark,
  Settings, Shield, User, Users,
} from "lucide-react";

/**
 * AppShell — server component that renders the full layout shell
 * (TopNav + left sidebar + right sidebar) and places children in the center feed area.
 * Meets accessibility, SEO, RTL layouts and locale-awareness.
 */
export default async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user as any;
  const t = await getTranslations("common");

  const [suggested, trending, active, notifCount] = await Promise.all([
    getSuggestedUsers(6),
    getTrendingTopics(6),
    getActiveFriends(6),
    getUnreadCount(),
  ]);

  const leftNavItems = [
    { href: "/", icon: Home, label: t("nav.home") },
    { href: "/explore", icon: Users, label: t("nav.friends") },
    { href: "/messages", icon: MessageCircle, label: t("nav.messages") },
    { href: "/saved", icon: Bookmark, label: t("nav.saved") },
    { href: "/notifications", icon: Bell, label: t("nav.notifications") },
    { href: "/reels", icon: Film, label: t("nav.watch") },
  ];

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopNav user={user} notifCount={notifCount} />

      <div className="flex max-w-[1280px] mx-auto pt-14 px-4 sm:px-6 md:px-8">
        {/* ── Left Sidebar (Responsive / RTL aligned) ── */}
        <aside className="hidden lg:flex flex-col fixed inset-inline-start-0 top-14 h-[calc(100vh-56px)] w-72 px-3 py-4 overflow-y-auto z-30">
          <Link
            href={user?.username ? `/${user.username}` : "#"}
            className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-zinc-800/60 transition-all mb-2 group"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 overflow-hidden flex-shrink-0">
              {user?.image
                ? <img src={user.image} alt="" className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center text-white font-bold">{user?.name?.[0] ?? "U"}</span>}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-zinc-100 text-sm truncate group-hover:text-violet-400 transition-colors">
                {user?.name || "User"}
              </p>
              <p className="text-xs text-zinc-500 truncate">
                {t("nav.viewProfile")}
              </p>
            </div>
          </Link>

          <nav className="space-y-0.5 mt-1">
            {leftNavItems.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100 transition-all group"
              >
                <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-600/20 group-hover:text-violet-400 transition-all">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="font-medium text-sm">{label}</span>
              </Link>
            ))}
            
            {user?.isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-amber-400 hover:bg-amber-500/10 transition-all group"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <span className="font-medium text-sm">{t("nav.admin")}</span>
              </Link>
            )}
          </nav>

          <div className="mt-auto pt-4 border-t border-zinc-800">
            <Link
              href="/settings"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-500 hover:bg-zinc-800/70 hover:text-zinc-300 transition-all"
            >
              <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
                <Settings className="w-5 h-5" />
              </div>
              <span className="font-medium text-sm">{t("nav.settings")}</span>
            </Link>
          </div>
        </aside>

        {/* ── Center Panel (RTL-aware margin) ── */}
        <main className="flex-1 lg:ms-72 lg:me-80 xl:me-88 min-h-screen overflow-y-auto">
          {children}
        </main>

        {/* ── Right Sidebar (Responsive / RTL aligned) ── */}
        <aside className="hidden lg:block fixed inset-inline-end-0 top-14 h-[calc(100vh-56px)] w-80 xl:w-88 px-4 py-4 overflow-y-auto z-30">
          <RightSidebar
            suggested={suggested as any[]}
            trending={trending as any[]}
            active={active as any[]}
          />
        </aside>
      </div>
    </div>
  );
}
