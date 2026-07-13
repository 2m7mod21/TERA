"use client";

import React, { useState, useTransition, useEffect } from "react";
import {
  Search, ShieldAlert, Award, Loader2, X, Key, Shield, LogOut,
  AlertCircle, FileText, MessageSquare, Globe, Heart, Activity,
  Smartphone, User, AlertTriangle, ArrowUpDown
} from "lucide-react";
import {
  getUsers, banUser, unbanUser, suspendUser, unsuspendUser,
  verifyUser, revokeVerification, deleteUser,
  getUserAdminDetails, banUserIP, forceUserPasswordReset,
  terminateUserSessionsAction, deviceBanUserAction
} from "@/server/actions/admin/users";

export default function UsersClient({
  initialUsers,
  initialCursor,
}: {
  initialUsers: any[];
  initialCursor: string | null;
}) {
  const [users, setUsers] = useState<any[]>(initialUsers);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "suspended" | "banned" | "verified" | "pending">("all");
  const [sortBy, setSortBy] = useState<"date" | "posts" | "followers" | "reports">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isPending, startTransition] = useTransition();

  // Modal details states
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [detailsTab, setDetailsTab] = useState<"info" | "posts" | "comments" | "likes" | "stories" | "security" | "dms">("info");
  const [privacyUnlocked, setPrivacyUnlocked] = useState(false);
  const [banReason, setBanReason] = useState("");

  const handleFetch = (
    searchVal = search,
    statusVal = status,
    sortByVal = sortBy,
    sortOrderVal = sortOrder,
    reset = false
  ) => {
    startTransition(async () => {
      const res = await getUsers({
        search: searchVal || undefined,
        status: statusVal === "all" ? undefined : statusVal,
        sortBy: sortByVal,
        sortOrder: sortOrderVal,
        cursor: reset ? undefined : (cursor || undefined),
      });
      if (reset) {
        setUsers(res.users);
      } else {
        setUsers((prev) => {
          const map = new Map();
          prev.forEach((u) => map.set(u.id, u));
          res.users.forEach((u) => map.set(u.id, u));
          return Array.from(map.values());
        });
      }
      setCursor(res.nextCursor);
    });
  };

  const handleAction = async (
    userId: string,
    actionFn: (id: string, ...args: any[]) => Promise<any>,
    actionArg?: string,
    successMsg?: string
  ) => {
    if (!confirm("Are you sure you want to perform this operation?")) return;
    setActionPending(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await actionFn(userId, actionArg ?? "");
      if (res && res.success) {
        setActionSuccess(successMsg ?? "Operation completed successfully.");
        // Refresh the open user details panel
        if (selectedUserId) {
          await loadUserDetails(selectedUserId);
        }
        // Refresh the table list in the background
        startTransition(() => {
          handleFetch(search, status, sortBy, sortOrder, true);
        });
      } else {
        setActionError((res && res.error) || "Action failed. Please try again.");
      }
    } catch (err: any) {
      setActionError(err?.message ?? "An unexpected error occurred.");
    } finally {
      setActionPending(false);
    }
  };

  const loadUserDetails = async (userId: string) => {
    setLoadingDetails(true);
    try {
      const res = await getUserAdminDetails(userId);
      if (res.user) {
        setUserDetails(res.user);
      }
    } catch (e) {
      alert("Error loading user profile details.");
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (selectedUserId) {
      loadUserDetails(selectedUserId);
      setDetailsTab("info");
      setPrivacyUnlocked(false);
      setBanReason("");
      setActionError(null);
      setActionSuccess(null);
      setActionPending(false);
    } else {
      setUserDetails(null);
      setActionError(null);
      setActionSuccess(null);
    }
  }, [selectedUserId]);

  const toggleSort = (field: typeof sortBy) => {
    const newOrder = sortBy === field && sortOrder === "desc" ? "asc" : "desc";
    setSortBy(field);
    setSortOrder(newOrder);
    handleFetch(search, status, field, newOrder, true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-violet-500 animate-pulse" />
          MEMBER CONTROL PANEL
        </h1>
        <p className="text-xs text-slate-400">View detailed metrics, inspect sessions/security history, and enforce platform moderation policies.</p>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-zinc-950 p-4 border border-zinc-850 rounded-2xl">
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search raw email, phone number, username or screen name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              handleFetch(e.target.value, status, sortBy, sortOrder, true);
            }}
            className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 focus:border-violet-500 rounded-xl text-xs text-slate-200 focus:outline-none transition-all placeholder:text-zinc-650"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          {(["all", "active", "suspended", "banned", "verified", "pending"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => {
                setStatus(opt);
                handleFetch(search, opt, sortBy, sortOrder, true);
              }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
                status === opt
                  ? "bg-violet-500/10 border-violet-500/30 text-violet-300 shadow-md shadow-violet-500/5"
                  : "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {opt === "all" ? "All Users" : opt}
            </button>
          ))}
        </div>
      </div>

      {/* MEMBERS TABLE */}
      <div className="border border-zinc-850 rounded-2xl overflow-hidden bg-zinc-950/80 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-850 text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-900/40">
                <th className="py-4 px-5 select-none cursor-pointer hover:bg-zinc-900/60" onClick={() => toggleSort("date")}>
                  <div className="flex items-center gap-1.5">
                    MEMBER DETAILS
                    <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                  </div>
                </th>
                <th className="py-4 px-5">ACCOUNT STATUS</th>
                <th className="py-4 px-5 select-none cursor-pointer hover:bg-zinc-900/60 text-center" onClick={() => toggleSort("posts")}>
                  <div className="flex items-center gap-1.5 justify-center">
                    POSTS
                    <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                  </div>
                </th>
                <th className="py-4 px-5 text-center">COMMENTS</th>
                <th className="py-4 px-5 select-none cursor-pointer hover:bg-zinc-900/60 text-center" onClick={() => toggleSort("followers")}>
                  <div className="flex items-center gap-1.5 justify-center">
                    FOLLOWERS
                    <ArrowUpDown className="w-3 h-3 text-zinc-500" />
                  </div>
                </th>
                <th className="py-4 px-5 select-none cursor-pointer hover:bg-zinc-900/60 text-center" onClick={() => toggleSort("reports")}>
                  <div className="flex items-center gap-1.5 justify-center text-rose-400">
                    REPORTS
                    <ArrowUpDown className="w-3 h-3 text-rose-500" />
                  </div>
                </th>
                <th className="py-4 px-5 text-right w-64">MODERATION ACTION PANEL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-zinc-500 bg-zinc-900/20">
                    No users matching these filters found.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const reportedCount = u._count?.reportedReports ?? 0;
                  return (
                    <tr key={u.id} className="hover:bg-zinc-900/30 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-850 flex-shrink-0 overflow-hidden flex items-center justify-center">
                            {u.profile?.avatarUrl ? (
                              <img src={u.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-zinc-500 font-bold uppercase text-xs">
                                {u.profile?.displayName?.[0] ?? "U"}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1">
                              <p className="font-bold text-zinc-200 hover:text-violet-400 transition-colors cursor-pointer" onClick={() => setSelectedUserId(u.id)}>
                                {u.profile?.displayName ?? "Unnamed"}
                              </p>
                              {u.verifiedBadge && (
                                <Award className="w-3.5 h-3.5 text-blue-400 fill-blue-400/20" />
                              )}
                              {u.isAdmin && (
                                <span className="px-1 text-[8px] border border-violet-500/30 bg-violet-500/10 text-violet-400 rounded">ADMIN</span>
                              )}
                            </div>
                            <p className="text-[10px] text-zinc-500">@{u.profile?.username ?? "username"}</p>
                            <p className="text-[9px] text-zinc-650 font-mono mt-0.5">{u.email || u.phone || "No login contact"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex flex-wrap gap-1.5">
                          {u.isBanned ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-455 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                              Banned ⛔
                            </span>
                          ) : u.isSuspended ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              Suspended 🚫
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-405 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Active ✅
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] text-zinc-550 mt-1">Joined {new Date(u.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td className="py-4 px-5 text-center text-zinc-350">{u._count?.posts ?? 0}</td>
                      <td className="py-4 px-5 text-center text-zinc-350">{u._count?.comments ?? 0}</td>
                      <td className="py-4 px-5 text-center text-zinc-350">{u._count?.followers ?? 0}</td>
                      <td className="py-4 px-5 text-center font-bold">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] ${reportedCount > 0 ? "bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30" : "text-zinc-600 bg-zinc-900/50"}`}>
                          {reportedCount}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right space-x-1.5">
                        <button
                          onClick={() => setSelectedUserId(u.id)}
                          className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-slate-200 transition-colors"
                        >
                          التفاصيل
                        </button>
                        
                        {u.isBanned ? (
                          <button
                            onClick={() => handleAction(u.id, unbanUser)}
                            className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-emerald-950/20 border border-emerald-500/20 hover:bg-emerald-500/10 text-emerald-400 transition-colors"
                          >
                            Unban
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              const r = prompt("Reason for banning this user account:");
                              if (r) handleAction(u.id, banUser, r);
                            }}
                            className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-rose-950/20 border border-rose-500/20 hover:bg-rose-500/10 text-rose-455 transition-colors"
                          >
                            Ban
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {cursor && (
          <div className="p-4 border-t border-zinc-850 flex justify-center bg-zinc-900/20">
            <button
              onClick={() => handleFetch(search, status, sortBy, sortOrder, false)}
              className="px-5 py-2 rounded-xl border border-zinc-850 bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-slate-350 cursor-pointer transition-all"
              disabled={isPending}
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin inline-block mr-1" /> : null}
              Load More Members
            </button>
          </div>
        )}
      </div>

      {/* FULL PAGE OVERFLOW SYSTEM DETAILS MODAL */}
      {selectedUserId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/95 backdrop-blur-md flex items-center justify-center p-4 scale-in">
          <div className="bg-zinc-950 border border-zinc-850 rounded-3xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-850 flex items-center justify-between bg-zinc-900/20">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-ping" />
                <h2 className="font-bold text-white text-md tracking-tight uppercase">User Account Dossier & Enforcement Center</h2>
              </div>
              <button
                onClick={() => setSelectedUserId(null)}
                className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-850 flex items-center justify-center hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all mouse-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {loadingDetails ? (
              <div className="flex-1 flex flex-col justify-center items-center">
                <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
                <p className="text-xs text-zinc-500 mt-2">Assembling details and activity streams...</p>
              </div>
            ) : !userDetails ? (
              <div className="flex-1 flex flex-col justify-center items-center text-zinc-400">
                <AlertCircle className="w-8 h-8 text-rose-505 mb-2" />
                <p className="text-sm">Failed to retrieve diagnostic user record.</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                
                {/* Left Side: General Profile Card & System Data */}
                <div className="w-full md:w-80 border-r border-zinc-850 p-5 overflow-y-auto space-y-5 flex-shrink-0 bg-zinc-900/10">
                  
                  {/* User Profile Avatar Cover details */}
                  <div className="text-center pb-4 border-b border-zinc-850 relative">
                    {/* Cover Preview (Simulated background) */}
                    <div className="h-16 w-full rounded-2xl bg-gradient-to-br from-violet-650 to-pink-700/60 overflow-hidden relative border border-zinc-800">
                      {userDetails.profile?.coverUrl && (
                        <img src={userDetails.profile.coverUrl} className="w-full h-full object-cover" alt="" />
                      )}
                    </div>
                    {/* Avatar */}
                    <div className="w-18 h-18 rounded-full border-4 border-zinc-950 bg-zinc-900 overflow-hidden mx-auto -mt-9 relative z-10 shadow-lg">
                      {userDetails.profile?.avatarUrl ? (
                        <img src={userDetails.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center font-bold text-lg text-white">
                          {userDetails.profile?.displayName?.[0] ?? "U"}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-white text-base mt-2 flex items-center justify-center gap-1">
                      {userDetails.profile?.displayName ?? "Unnamed"}
                      {userDetails.verifiedBadge && <Award className="w-4 h-4 text-blue-400 fill-blue-400/20" />}
                    </h3>
                    <p className="text-xs text-violet-400">@{userDetails.profile?.username ?? "username"}</p>
                    
                    {userDetails.profile?.bio && (
                      <p className="text-[11px] text-zinc-400 italic mt-2 px-2 border-l-2 border-zinc-850/50">{userDetails.profile.bio}</p>
                    )}
                  </div>

                  {/* Account Metadata List */}
                  <div className="space-y-3 bg-zinc-909/35 p-3.5 border border-zinc-850 rounded-2xl text-[10px]">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-550">UUID Reference</span>
                      <span className="text-zinc-300 font-mono select-all bg-zinc-900 px-1 py-0.5 rounded text-[8px]">{userDetails.id}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-550">Email</span>
                      <span className="text-zinc-305 font-mono">{userDetails.email || "Null"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-550">Phone</span>
                      <span className="text-zinc-305 font-mono">{userDetails.phone || "Null"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-550">Registration</span>
                      <span className="text-zinc-305">{new Date(userDetails.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-550">Last Active Status</span>
                      <span className="text-zinc-305">{userDetails.lastActiveAt ? new Date(userDetails.lastActiveAt).toLocaleString() : "Unknown"}</span>
                    </div>
                  </div>

                  {/* Profile Metadata */}
                  <div className="space-y-3 bg-zinc-909/35 p-3.5 border border-zinc-850 rounded-2xl text-[10px]">
                    <h4 className="font-bold text-zinc-400 uppercase text-[9px] tracking-wider mb-2">Location & Language Details</h4>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-550">Location</span>
                      <span className="text-zinc-305 flex items-center gap-1">
                        <Globe className="w-3 h-3 text-zinc-500" />
                        {userDetails.profile?.location || "Not Set"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-550">Website</span>
                      {userDetails.profile?.websiteUrl ? (
                        <a href={userDetails.profile.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-violet-400 truncate max-w-[150px] hover:underline">
                          {userDetails.profile.websiteUrl}
                        </a>
                      ) : (
                        <span className="text-zinc-600">None</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-550">Relationship</span>
                      <span className="text-zinc-305">{userDetails.profile?.relationshipStatus || "Not Set"}</span>
                    </div>
                  </div>

                  {/* Metrics Badges */}
                  <div className="grid grid-cols-2 gap-2 text-center pb-2">
                    <div className="bg-zinc-900/50 p-2 border border-zinc-850 rounded-xl">
                      <p className="text-[16px] font-bold text-white">{userDetails._count?.posts ?? 0}</p>
                      <p className="text-[9px] text-zinc-550 uppercase">Posts</p>
                    </div>
                    <div className="bg-zinc-900/50 p-2 border border-zinc-850 rounded-xl">
                      <p className="text-[16px] font-bold text-white">{userDetails._count?.comments ?? 0}</p>
                      <p className="text-[9px] text-zinc-550 uppercase">Comments</p>
                    </div>
                    <div className="bg-zinc-900/50 p-2 border border-zinc-850 rounded-xl">
                      <p className="text-[16px] font-bold text-white">{userDetails._count?.followers ?? 0}</p>
                      <p className="text-[9px] text-zinc-550 uppercase">Followers</p>
                    </div>
                    <div className="bg-zinc-900/50 p-2 border border-zinc-850 rounded-xl">
                      <p className="text-[16px] font-bold text-rose-400">{userDetails._count?.reportedReports ?? 0}</p>
                      <p className="text-[9px] text-rose-505 uppercase text-rose-455">Reports</p>
                    </div>
                  </div>
                </div>

                {/* Right Side: Tab Select and Content Preview */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Tabs bar */}
                  <div className="flex border-b border-zinc-850 bg-zinc-950 overflow-x-auto">
                    {[
                      { id: "info", label: "Overview Info", icon: User },
                      { id: "posts", label: "Posts", icon: FileText },
                      { id: "comments", label: "Comments", icon: MessageSquare },
                      { id: "likes", label: "Likes", icon: Heart },
                      { id: "stories", label: "Stories", icon: Activity },
                      { id: "security", label: "Security & Login Logs", icon: Smartphone },
                      { id: "dms", label: "Chat Data", icon: MessageSquare },
                    ].map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setDetailsTab(tab.id as any)}
                          className={`px-5 py-3 text-xs font-bold whitespace-nowrap border-b-2 flex items-center gap-1.5 transition-all ${
                            detailsTab === tab.id
                              ? "border-violet-500 text-violet-400 bg-violet-500/5"
                              : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/20"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Tab Contents Frame */}
                  <div className="flex-1 p-5 overflow-y-auto min-h-0 bg-zinc-950/20 space-y-6">
                    
                    {/* OVERVIEW INFO & ACTIONS TAB */}
                    {detailsTab === "info" && (
                      <div className="space-y-6">
                        {/* Enforcement Status block */}
                        <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-2xl flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                          <div>
                            <h4 className="font-bold text-white text-xs">Current Enforcement Status</h4>
                            <p className="text-[10px] text-zinc-400 mt-0.5">Diagnose restriction values currently on this member database account.</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {userDetails.isBanned ? (
                              <span className="px-3 py-1 text-xs font-bold rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 animate-pulse">ACCOUNT STATUS: BANNED</span>
                            ) : userDetails.isSuspended ? (
                              <span className="px-3 py-1 text-xs font-bold rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-400">ACCOUNT STATUS: SUSPENDED</span>
                            ) : (
                              <span className="px-3 py-1 text-xs font-bold rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">ACCOUNT STATUS: ACTIVE</span>
                            )}
                          </div>
                        </div>

                        {/* Enforcement Policy Form Drawer */}
                        <div className="border border-zinc-850 rounded-2xl overflow-hidden bg-zinc-950/70 p-5 space-y-4">
                          <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4 text-violet-500" />
                            ACCOUNTS MODERATION ACTIONS
                          </h4>
                          <p className="text-[10px] text-zinc-400">Input security notes / ban reasons below first, then trigger one of the policy compliance buttons.</p>

                          <input
                            type="text"
                            placeholder="Input ban reason / action log description ..."
                            value={banReason}
                            onChange={(e) => setBanReason(e.target.value)}
                            disabled={actionPending}
                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-350 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50"
                          />

                          {/* Action Feedback Banner */}
                          {actionPending && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs">
                              <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                              Executing action, please wait...
                            </div>
                          )}
                          {actionSuccess && !actionPending && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                              {actionSuccess}
                            </div>
                          )}
                          {actionError && !actionPending && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                              {actionError}
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {userDetails.isBanned ? (
                              <button
                                disabled={actionPending}
                                onClick={() => handleAction(userDetails.id, unbanUser, "", "Account successfully restored.")}
                                className="px-4 py-2 border border-emerald-600/30 bg-emerald-650/10 hover:bg-emerald-600/20 text-emerald-400 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Restore Account (Unban)
                              </button>
                            ) : (
                              <>
                                <button
                                  disabled={actionPending}
                                  onClick={() => handleAction(userDetails.id, banUser, banReason || "Admin manual ban.", "User account has been banned.")}
                                  className="px-4 py-2 border border-rose-600/30 bg-rose-650/10 hover:bg-rose-600/20 text-rose-400 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  Standard Ban (Account)
                                </button>
                                <button
                                  disabled={actionPending}
                                  onClick={() => handleAction(userDetails.id, banUserIP, banReason || "IP ban.", "User IPs have been blocked.")}
                                  className="px-4 py-2 border border-rose-700 bg-rose-900/35 hover:bg-rose-909/50 text-rose-300 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  IP Ban (Blocked IPs List)
                                </button>
                                <button
                                  disabled={actionPending}
                                  onClick={() => handleAction(userDetails.id, deviceBanUserAction, banReason || "Device ban.", "Device ban applied.")}
                                  className="px-4 py-2 border border-orange-700 bg-orange-950/20 hover:bg-orange-900/30 text-orange-400 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  Device Ban User
                                </button>
                              </>
                            )}

                            {userDetails.isSuspended ? (
                              <button
                                disabled={actionPending}
                                onClick={() => handleAction(userDetails.id, unsuspendUser, "", "Account suspension lifted.")}
                                className="px-4 py-2 border border-emerald-600/30 bg-emerald-650/10 hover:bg-emerald-600/20 text-emerald-400 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Unsuspend Account
                              </button>
                            ) : (
                              <button
                                disabled={actionPending}
                                onClick={() => handleAction(userDetails.id, suspendUser, "", "Account has been suspended.")}
                                className="px-4 py-2 border border-amber-600/30 bg-amber-650/10 hover:bg-amber-600/20 text-amber-400 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Suspend Account (Deactivate)
                              </button>
                            )}

                            {userDetails.verifiedBadge ? (
                              <button
                                disabled={actionPending}
                                onClick={() => handleAction(userDetails.id, revokeVerification, "", "Verification badge revoked.")}
                                className="px-4 py-2 border border-zinc-805 bg-zinc-900 hover:bg-zinc-800 text-zinc-350 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Revoke Verification Badge
                              </button>
                            ) : (
                              <button
                                disabled={actionPending}
                                onClick={() => handleAction(userDetails.id, verifyUser, "", "Verification badge granted.")}
                                className="px-4 py-2 border border-blue-600/30 bg-blue-650/10 hover:bg-blue-600/20 text-blue-400 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Grant Verification Badge
                              </button>
                            )}

                            <button
                              disabled={actionPending}
                              onClick={() => handleAction(userDetails.id, forceUserPasswordReset, "", "Password reset forced. User is logged out.")}
                              className="px-4 py-2 border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-350 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Key className="w-3.5 h-3.5" />
                              Force Pass Reset
                            </button>

                            <button
                              disabled={actionPending}
                              onClick={() => handleAction(userDetails.id, terminateUserSessionsAction, "", "All active sessions terminated.")}
                              className="px-4 py-2 border border-red-750/30 bg-zinc-900 hover:bg-red-500/10 text-red-400 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                              Force Logout All
                            </button>

                            <button
                              disabled={actionPending}
                              onClick={() => handleAction(userDetails.id, deleteUser, "", "User account permanently deleted.")}
                              className="px-4 py-2 border border-rose-955 bg-rose-650 text-slate-100 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Destroy User Account
                            </button>
                          </div>
                        </div>

                        {/* Recent User reports against them listings */}
                        <div className="space-y-3">
                          <h4 className="font-bold text-white text-xs">Flagged Content Reports Against User</h4>
                          {userDetails.reportedReports?.length === 0 ? (
                            <p className="text-[11px] text-zinc-550 border border-zinc-850 rounded-xl p-3.5 bg-zinc-900/10 text-center">Good Standing: No filed reports against this member account.</p>
                          ) : (
                            <div className="space-y-2">
                              {userDetails.reportedReports?.map((rep: any) => (
                                <div key={rep.id} className="p-3 border border-zinc-850 rounded-xl bg-zinc-900/30 text-[10px] space-y-1">
                                  <div className="flex justify-between items-center text-[9px] text-zinc-500">
                                    <span>Reporter: @{rep.reporter?.profile?.username || "anonymous"}</span>
                                    <span>{new Date(rep.createdAt).toLocaleString()}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <p className="text-zinc-200"><span className="font-semibold text-rose-455">[{rep.category}]</span> {rep.reason}</p>
                                    <span className="px-1.5 py-0.5 rounded text-[8px] bg-amber-500/15 border border-amber-500/30 text-amber-405">{rep.status}</span>
                                  </div>
                                  {rep.details && (
                                    <p className="text-zinc-400 mt-1 italic pl-2 border-l border-zinc-800">Details: "{rep.details}"</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* POSTS TAB */}
                    {detailsTab === "posts" && (
                      <div className="space-y-3">
                        <h4 className="font-bold text-white text-xs">Authored Posts Queue (Showing latest 10)</h4>
                        {userDetails.posts?.length === 0 ? (
                          <p className="text-center py-10 text-xs text-zinc-550">This user hasn't posted anything yet.</p>
                        ) : (
                          <div className="space-y-3">
                            {userDetails.posts.map((post: any) => (
                              <div key={post.id} className="p-4 border border-zinc-850 rounded-2xl bg-zinc-900/20 text-xs space-y-2">
                                <div className="flex justify-between text-[9px] text-zinc-550 font-mono">
                                  <span>ID: {post.id}</span>
                                  <span>{new Date(post.createdAt).toLocaleString()}</span>
                                </div>
                                <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{post.content || <span className="text-zinc-650 italic">[Media only content]</span>}</p>
                                <div className="flex gap-4 text-[9px] text-zinc-550 border-t border-zinc-900/60 pt-2">
                                  <span>Visibility: {post.visibility}</span>
                                  <span>Comments: {post._count?.comments ?? 0}</span>
                                  <span>Reactions: {post._count?.reactions ?? 0}</span>
                                  <span>Views: {post.viewCount ?? 0}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* COMMENTS TAB */}
                    {detailsTab === "comments" && (
                      <div className="space-y-3">
                        <h4 className="font-bold text-white text-xs">Authored Comments Feed (Showing latest 10)</h4>
                        {userDetails.comments?.length === 0 ? (
                          <p className="text-center py-10 text-xs text-zinc-550">This user hasn't commented on any posts yet.</p>
                        ) : (
                          <div className="space-y-3">
                            {userDetails.comments.map((comment: any) => (
                              <div key={comment.id} className="p-4 border border-zinc-850 rounded-2xl bg-zinc-900/20 text-xs space-y-2">
                                <div className="flex justify-between text-[9px] text-zinc-550 font-mono">
                                  <span>Comment ID: {comment.id}</span>
                                  <span>{new Date(comment.createdAt).toLocaleString()}</span>
                                </div>
                                <p className="text-zinc-300">"{comment.content}"</p>
                                <div className="text-[9px] text-zinc-600 bg-zinc-905 p-2 rounded-lg truncate">
                                  On Post: {comment.post?.content || "Refer post ID: " + comment.postId}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* LIKES & REACTIONS TAB */}
                    {detailsTab === "likes" && (
                      <div className="space-y-3">
                        <h4 className="font-bold text-white text-xs">Latest Reacted Posts (Showing latest 10)</h4>
                        {userDetails.reactions?.length === 0 ? (
                          <p className="text-center py-10 text-xs text-zinc-550">No registered likes or reactions for this user.</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {userDetails.reactions.map((rx: any) => (
                              <div key={rx.id} className="p-3.5 border border-zinc-8 signal bg-zinc-900/20 text-xs space-y-1.5 select-none rounded-2xl">
                                <div className="flex justify-between text-[9px] text-zinc-600">
                                  <span className="font-bold uppercase tracking-wider text-violet-400">{rx.type}</span>
                                  <span>{new Date(rx.createdAt).toLocaleDateString()}</span>
                                </div>
                                {rx.post && (
                                  <p className="text-zinc-400 truncate italic">On Post: "{rx.post.content || "[Media]"}"</p>
                                )}
                                {rx.comment && (
                                  <p className="text-zinc-400 truncate italic">On Comment: "{rx.comment.content}"</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* STORIES TAB */}
                    {detailsTab === "stories" && (
                      <div className="space-y-3">
                        <h4 className="font-bold text-white text-xs">Latest User Stories (Showing latest 10)</h4>
                        {userDetails.stories?.length === 0 ? (
                          <p className="text-center py-10 text-xs text-zinc-555">No stories registered from this user.</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {userDetails.stories.map((story: any) => (
                              <div key={story.id} className="p-3 border border-zinc-850 rounded-2xl bg-zinc-900/20 text-xs space-y-2">
                                <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                                  <span>{story.type}</span>
                                  <span>Expires {new Date(story.expiresAt).toLocaleDateString()}</span>
                                </div>
                                {story.mediaUrl && (
                                  <div className="h-32 w-full rounded-lg overflow-hidden bg-zinc-950 border border-zinc-850 relative">
                                    <img src={story.mediaUrl} className="w-full h-full object-cover" alt="" />
                                  </div>
                                )}
                                {story.textContent && (
                                  <p className="text-zinc-350 italic">Text: "{story.textContent}"</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* SECURITY & LOGIN LOGS TAB */}
                    {detailsTab === "security" && (
                      <div className="space-y-6">
                        {/* Active Sessions list */}
                        <div className="space-y-3">
                          <h4 className="font-bold text-zinc-350 text-xs flex items-center gap-1.5">
                            <Activity className="w-4 h-4 text-violet-500" />
                            ACTIVE DEVICESS / LOGIN SESSIONS
                          </h4>
                          {userDetails.userSessions?.length === 0 ? (
                            <p className="text-[11px] text-zinc-500 italic p-3 border border-zinc-850 rounded-2xl text-center">No active login sessions found.</p>
                          ) : (
                            <div className="space-y-2">
                              {userDetails.userSessions.map((session: any) => (
                                <div key={session.id} className="p-3 border border-zinc-850 bg-zinc-900/30 rounded-xl flex items-center justify-between text-[10px]">
                                  <div className="space-y-1">
                                    <p className="font-semibold text-zinc-200">Device/Browser: {session.userAgent || "Unknown Device"}</p>
                                    <p className="text-zinc-500 font-mono">IP Address: {session.ip || "Unknown IP"} | Expires: {new Date(session.expiresAt).toLocaleString()}</p>
                                  </div>
                                  <button
                                    onClick={() => handleAction(session.id, terminateUserSessionsAction)}
                                    className="px-2 py-1 text-[9px] bg-red-950/20 border border-red-500/20 hover:bg-red-500/10 text-red-300 rounded-lg"
                                  >
                                    De-auth Session
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Login success/failure history logs */}
                        <div className="space-y-3">
                          <h4 className="font-bold text-zinc-350 text-xs flex items-center gap-1.5 font-mono">
                            <Smartphone className="w-4 h-4 text-violet-500" />
                            LOGIN ATTEMPTS AUDIT LOG
                          </h4>
                          {userDetails.loginHistory?.length === 0 ? (
                            <p className="text-[11px] text-zinc-550 italic p-3 border border-zinc-850 rounded-2xl text-center">No login attempts history logged in the DB.</p>
                          ) : (
                            <div className="border border-zinc-850 rounded-2xl overflow-hidden text-[10px]">
                              <table className="w-full text-left">
                                <thead>
                                  <tr className="bg-zinc-900/40 border-b border-zinc-850 text-[9px] font-bold text-zinc-400">
                                    <th className="py-2.5 px-4">TIMESTAMP</th>
                                    <th className="py-2.5 px-4 font-mono">IP</th>
                                    <th className="py-2.5 px-4">DEVICE AGENT</th>
                                    <th className="py-2.5 px-4 text-right">SUCCESS</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-850 bg-zinc-950/20">
                                  {userDetails.loginHistory.map((log: any) => (
                                    <tr key={log.id} className="hover:bg-zinc-900/20">
                                      <td className="py-2.5 px-4 text-zinc-400">{new Date(log.createdAt).toLocaleString()}</td>
                                      <td className="py-2.5 px-4 text-zinc-300 font-mono">{log.ip || "No IP logged"}</td>
                                      <td className="py-2.5 px-4 text-zinc-400 truncate max-w-[250px]">{log.userAgent || log.device || "Unknown Client"}</td>
                                      <td className="py-2.5 px-4 text-right">
                                        {log.success ? (
                                          <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded text-[8px]">OK</span>
                                        ) : (
                                          <span className="text-rose-455 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded text-[8px]">FAIL</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* PRIVATE DMS DISCLAIMER & PREVIEW */}
                    {detailsTab === "dms" && (
                      <div className="space-y-4">
                        <div className="bg-amber-500/5 border border-amber-505/25 p-4 rounded-2xl space-y-3">
                          <h4 className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4" />
                            CONFIDENTIALITY DISCLAIMER (GDPR/PRIVACY COMPLIANCE)
                          </h4>
                          <p className="text-[10px] text-zinc-350 leading-relaxed">
                            Private direct messages are encrypted and protected under member privacy policies. Reading raw user DMs is strictly restricted. Only override this check under official security audits, reports investigations, or explicitly mandated judicial compliance.
                          </p>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => setPrivacyUnlocked(!privacyUnlocked)}
                              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                                privacyUnlocked
                                  ? "bg-rose-500/10 border border-rose-500/30 text-rose-455 hover:bg-rose-500/20"
                                  : "bg-amber-505 bg-amber-500/10 border border-amber-600/30 text-amber-400 hover:bg-amber-500/25"
                              }`}
                            >
                              {privacyUnlocked ? "Lock Private Chats Data" : "I understand. Override DM Protection"}
                            </button>
                          </div>
                        </div>

                        {privacyUnlocked ? (
                          <div className="space-y-3 scale-in">
                            <h4 className="font-bold text-white text-xs">Direct Messenger Diagnostics</h4>
                            <p className="text-[10px] text-zinc-400 font-medium">Total conversation memberships: {userDetails.conversations?.length || 0}</p>
                            <p className="text-[11px] text-zinc-550 border border-zinc-850 p-4 rounded-xl text-center italic">
                              Conversations list is sanitized. In simulated compliance mode, no raw logs are exposed.
                            </p>
                          </div>
                        ) : (
                          <div className="p-8 text-center text-zinc-550 border border-dashed border-zinc-850 rounded-2xl bg-zinc-950/20">
                            🔒 Private chat streams are masked. Unlock warning above to reveal dashboard info.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
