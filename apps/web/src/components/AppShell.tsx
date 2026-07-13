import React from "react";
import Link from "next/link";
import { auth } from "@/server/auth/config";
import { getSuggestedUsers, getTrendingTopics, getActiveFriends } from "@/server/actions/feed";
import { getUnreadCount } from "@/server/actions/notifications";
import TopNav from "@/components/TopNav";
import RightSidebar from "@/components/RightSidebar";
import {
  Home, MessageCircle, Bell, Film, Bookmark,
  Settings, Shield, User,
} from "lucide-react";

// Left sidebar nav items (mirrors HomeFeed)
const LEFT_NAV = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/explore", icon: Bell, label: "Friends" },
  { href: "/messages", icon: MessageCircle, label: "Messages" },
  { href: "/saved", icon: Bookmark, label: "Saved" },
  { href: "/notifications", icon: Bell, label: "Notifications" },
  { href: "/reels", icon: Film, label: "Watch" },
];

/**
 * AppShell — server component that renders the full layout shell
 * (TopNav + left sidebar + right sidebar) and places children in the center feed area.
 *
 * Usage:
 *   <AppShell>
 *     <YourPageContent />
 *   </AppShell>
 */
export default async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user as any;

  const [suggested, trending, active, notifCount] = await Promise.all([
    getSuggestedUsers(6),
    getTrendingTopics(6),
    getActiveFriends(6),
    getUnreadCount(),
  ]);

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopNav user={user} notifCount={notifCount} />

      <div className="flex max-w-[1280px] mx-auto pt-14">
        {/* ── Left Sidebar ── */}
        <aside className="hidden lg:flex flex-col fixed left-0 top-14 h-[calc(100vh-56px)] w-72 px-3 py-4 overflow-y-auto z-30">
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
              <p className="font-semibold text-zinc-100 text-sm truncate group-hover:text-violet-400 transition-colors">{user?.name || "User"}</p>
              <p className="text-xs text-zinc-500 truncate">View your profile</p>
            </div>
          </Link>

          <nav className="space-y-0.5 mt-1">
            {LEFT_NAV.map(({ href, icon: Icon, label }) => (
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
            {user?.username && (
              <Link href={`/${user.username}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100 transition-all group">
                <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-600/20 group-hover:text-violet-400 transition-all">
                  <User className="w-5 h-5" />
                </div>
                <span className="font-medium text-sm">Profile</span>
              </Link>
            )}
            {user?.isAdmin && (
              <Link href="/admin" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-amber-400 hover:bg-amber-500/10 transition-all group">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <span className="font-medium text-sm">Admin Panel</span>
              </Link>
            )}
          </nav>

          <div className="mt-auto pt-4 border-t border-zinc-800">
            <Link href="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-500 hover:bg-zinc-800/70 hover:text-zinc-300 transition-all">
              <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
                <Settings className="w-5 h-5" />
              </div>
              <span className="font-medium text-sm">Settings</span>
            </Link>
          </div>
        </aside>

        {/* ── Center Panel ── */}
        <main className="flex-1 lg:ml-72 lg:mr-80 xl:mr-88 min-h-screen overflow-y-auto">
          {children}
        </main>

        {/* ── Right Sidebar ── */}
        <aside className="hidden lg:block fixed right-0 top-14 h-[calc(100vh-56px)] w-80 xl:w-88 px-4 py-4 overflow-y-auto z-30">
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
