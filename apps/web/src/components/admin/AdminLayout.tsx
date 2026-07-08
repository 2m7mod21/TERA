"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PermissionMatrix } from "@/lib/adminAuth";
import {
  LayoutDashboard,
  Users,
  BadgeCheck,
  FileText,
  ShieldAlert,
  Bot,
  MessageSquare,
  BarChart3,
  DollarSign,
  Megaphone,
  Settings,
  Bell,
  Lock,
  UserCog,
  Database,
  Monitor,
  ClipboardList,
  Headphones,
  ChevronLeft,
  ChevronRight,
  Shield,
  LogOut,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  section: keyof PermissionMatrix;
  group: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, section: "dashboard", group: "Overview" },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, section: "analytics", group: "Overview" },
  { href: "/admin/users", label: "Users", icon: Users, section: "users", group: "People" },
  { href: "/admin/verification", label: "Verification", icon: BadgeCheck, section: "verification", group: "People" },
  { href: "/admin/support", label: "Support Center", icon: Headphones, section: "support", group: "People" },
  { href: "/admin/content", label: "Content", icon: FileText, section: "content", group: "Moderation" },
  { href: "/admin/reports", label: "Reports", icon: ShieldAlert, section: "reports", group: "Moderation" },
  { href: "/admin/ai-moderation", label: "AI Moderation", icon: Bot, section: "aiModeration", group: "Moderation" },
  { href: "/admin/messages", label: "Messages", icon: MessageSquare, section: "messages", group: "Moderation" },
  { href: "/admin/monetization", label: "Monetization", icon: DollarSign, section: "monetization", group: "Business" },
  { href: "/admin/ads", label: "Ads Manager", icon: Megaphone, section: "ads", group: "Business" },
  { href: "/admin/notifications", label: "Notifications", icon: Bell, section: "notifications", group: "Platform" },
  { href: "/admin/settings", label: "Settings", icon: Settings, section: "settings", group: "Platform" },
  { href: "/admin/security", label: "Security", icon: Lock, section: "security", group: "Platform" },
  { href: "/admin/admin-management", label: "Admin Team", icon: UserCog, section: "adminManagement", group: "System" },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ClipboardList, section: "auditLogs", group: "System" },
  { href: "/admin/system", label: "System Monitor", icon: Monitor, section: "systemMonitor", group: "System" },
  { href: "/admin/database", label: "Database", icon: Database, section: "database", group: "System" },
];

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  SUPER_ADMIN: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  MODERATOR: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  SUPPORT: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  ANALYST: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

export default function AdminLayout({
  children,
  role,
  permissions,
}: {
  children: React.ReactNode;
  role: string;
  permissions: PermissionMatrix;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Filter nav items to only show sections the admin can read
  const visibleItems = NAV_ITEMS.filter(
    (item) => permissions[item.section]?.read
  );

  // Group items
  const groups = Array.from(new Set(visibleItems.map((i) => i.group)));

  return (
    <div className="flex h-screen bg-[#0a0a0f] text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-white/5 bg-[#0d0d14] transition-all duration-300 ${
          collapsed ? "w-[60px]" : "w-[220px]"
        } flex-shrink-0`}
      >
        {/* Logo */}
        <div
          className={`flex items-center gap-2.5 px-4 py-5 border-b border-white/5 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-xs font-black tracking-wider text-white">TERA</p>
              <p className="text-[9px] text-slate-500 font-medium tracking-widest uppercase">Admin</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 scrollbar-none">
          {groups.map((group) => {
            const items = visibleItems.filter((i) => i.group === group);
            return (
              <div key={group} className="mb-1">
                {!collapsed && (
                  <p className="px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-600">
                    {group}
                  </p>
                )}
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center gap-2.5 mx-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                        isActive
                          ? "bg-violet-500/15 text-violet-300"
                          : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
                      } ${collapsed ? "justify-center" : ""}`}
                    >
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-violet-400" : ""}`} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/5 p-3 space-y-2">
          {/* Role badge */}
          {!collapsed && (
            <div
              className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border text-center ${
                ROLE_COLORS[role] || "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              {role.replace("_", " ")}
            </div>
          )}
          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="w-full flex items-center justify-center py-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
          {/* Back to site */}
          <Link
            href="/"
            className={`flex items-center gap-2 py-1.5 px-2 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors text-xs ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
            {!collapsed && <span>Back to Site</span>}
          </Link>
        </div>
      </aside>

      {/* Main area */}
      <main className="flex-1 overflow-y-auto">
        <div className="min-h-full p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
