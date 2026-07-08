"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Home, Users, MessageCircle, Bell, Video, Search, Settings,
  LogOut, User, Shield, ChevronDown, X, Menu,
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";

interface TopNavProps {
  user: any;
  notifCount?: number;
  msgCount?: number;
}

export default function TopNav({ user, notifCount = 0, msgCount = 0 }: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQ, setSearchQ] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/explore", icon: Users, label: "Friends" },
    { href: "/messages", icon: MessageCircle, label: "Messages", badge: msgCount },
    { href: "/notifications", icon: Bell, label: "Notifications", badge: notifCount },
    { href: "/reels", icon: Video, label: "Watch" },
  ];

  const avatar = user?.image;
  const displayName = user?.name || "User";
  const username = user?.username;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQ.trim()) {
      router.push(`/explore?q=${encodeURIComponent(searchQ.trim())}`);
      setShowSearch(false);
      setSearchQ("");
    }
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 h-14 glass border-b border-white/[0.06] flex items-center px-4 gap-2">
        {/* Left: Logo + Search */}
        <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
          <Link href="/" className="flex items-center gap-1.5 mr-1">
            <div className="w-9 h-9 rounded-xl gradient-btn flex items-center justify-center flex-shrink-0">
              <span className="text-white font-black text-lg leading-none">T</span>
            </div>
            <span className="hidden xl:block font-black text-xl gradient-text tracking-tight">TERA</span>
          </Link>
          {/* Search bar desktop */}
          <div className="hidden md:flex items-center bg-zinc-800/80 hover:bg-zinc-800 rounded-full px-3 py-1.5 gap-2 w-52 lg:w-64 transition-all border border-transparent focus-within:border-violet-500/50 focus-within:bg-zinc-800">
            <Search className="w-4 h-4 text-zinc-400 flex-shrink-0" />
            <form onSubmit={handleSearch} className="flex-1">
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search TERA..."
                className="bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none w-full"
              />
            </form>
          </div>
        </div>

        {/* Center: Nav Items */}
        <div className="hidden md:flex items-center justify-center flex-1 gap-1">
          {navItems.map(({ href, icon: Icon, label, badge }) => {
            const active = pathname === href;
            // Skip notification item in center nav (handled separately as dropdown)
            if (href === "/notifications") return null;
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={`relative flex flex-col items-center justify-center px-5 py-2 rounded-xl transition-all group h-12 ${
                  active
                    ? "text-violet-400 nav-item-active"
                    : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-200"
                }`}
              >
                <Icon className={`w-6 h-6 transition-all ${active ? "stroke-[2.5]" : ""}`} />
                {!!badge && badge > 0 && (
                  <span className="notif-badge">{badge > 9 ? "9+" : badge}</span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Right: Notification Bell + User menu */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
          {/* Mobile search */}
          <button
            className="md:hidden w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center"
            onClick={() => setShowSearch(true)}
          >
            <Search className="w-4 h-4 text-zinc-300" />
          </button>

          {/* Mobile nav toggle */}
          <button
            className="md:hidden w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center"
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            <Menu className="w-4 h-4 text-zinc-300" />
          </button>

          {/* Admin badge */}
          {user?.isAdmin && (
            <Link
              href="/admin"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-400 text-xs font-semibold border border-amber-500/20 hover:bg-amber-500/25 transition-all"
            >
              <Shield className="w-3.5 h-3.5" />
              Admin
            </Link>
          )}

          {/* Messages shortcut */}
          <Link
            href="/messages"
            className={`hidden md:flex w-9 h-9 rounded-full items-center justify-center relative transition-all ${
              pathname === "/messages" ? "bg-violet-600/20 text-violet-400" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            {msgCount > 0 && <span className="notif-badge">{msgCount > 9 ? "9+" : msgCount}</span>}
          </Link>

          {/* Notification Bell dropdown (replaces static link) */}
          <div className="hidden md:flex">
            {user?.id ? (
              <NotificationBell currentUserId={user.id} initialCount={notifCount} />
            ) : (
              <Link
                href="/notifications"
                className={`w-9 h-9 rounded-full flex items-center justify-center relative transition-all ${
                  pathname === "/notifications" ? "bg-violet-600/20 text-violet-400" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                <Bell className="w-4 h-4" />
                {notifCount > 0 && <span className="notif-badge">{notifCount > 9 ? "9+" : notifCount}</span>}
              </Link>
            )}
          </div>

          {/* Avatar dropdown */}
          <div className="relative" ref={dropRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-zinc-800 transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0">
                {avatar ? (
                  <img src={avatar} className="w-full h-full object-cover" alt="" />
                ) : (displayName[0]?.toUpperCase() ?? "U")}
              </div>
              <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform hidden md:block ${showDropdown ? "rotate-180" : ""}`} />
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-56 glass rounded-2xl border border-zinc-700/50 shadow-2xl overflow-hidden scale-in z-50">
                <div className="px-4 py-3 border-b border-zinc-800">
                  <p className="font-semibold text-zinc-100 text-sm">{displayName}</p>
                  <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                </div>
                <div className="p-1.5 space-y-0.5">
                  {username && (
                    <Link
                      href={`/${username}`}
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-all"
                    >
                      <User className="w-4 h-4 text-zinc-400" />
                      View Profile
                    </Link>
                  )}
                  <Link
                    href="/settings"
                    onClick={() => setShowDropdown(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-all"
                  >
                    <Settings className="w-4 h-4 text-zinc-400" />
                    Settings
                  </Link>
                  <div className="border-t border-zinc-800 mt-1 pt-1">
                    <button
                      onClick={() => signOut({ callbackUrl: "/auth/login" })}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-rose-400 hover:bg-rose-500/10 transition-all w-full text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile nav drawer */}
      {mobileMenu && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileMenu(false)} />
          <div className="absolute top-14 left-0 right-0 glass border-b border-zinc-800 p-4 scale-in">
            <div className="grid grid-cols-5 gap-2">
              {navItems.map(({ href, icon: Icon, label, badge }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenu(false)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all relative ${
                    pathname === href ? "bg-violet-600/20 text-violet-400" : "text-zinc-400 hover:bg-zinc-800"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{label}</span>
                  {!!badge && badge > 0 && <span className="notif-badge">{badge > 9 ? "9+" : badge}</span>}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile search overlay */}
      {showSearch && (
        <div className="fixed inset-0 z-50 bg-zinc-950/95 flex flex-col p-4 md:hidden">
          <form onSubmit={handleSearch} className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 bg-zinc-800 rounded-2xl px-4 py-3">
              <Search className="w-4 h-4 text-zinc-400" />
              <input
                ref={searchRef}
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search TERA..."
                className="bg-transparent text-zinc-100 outline-none flex-1"
                autoFocus
              />
            </div>
            <button type="button" onClick={() => setShowSearch(false)} className="text-zinc-400">
              <X className="w-5 h-5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
