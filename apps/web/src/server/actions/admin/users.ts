"use server";

import { prisma } from "@/lib/db";
import { requireAdmin, writeAuditLog } from "@/lib/adminAuth";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";

const USER_PAGE_SIZE = 25;

export type UserFilters = {
  search?: string;
  status?: "all" | "active" | "suspended" | "banned" | "verified" | "pending";
  sortBy?: "date" | "posts" | "followers" | "reports";
  sortOrder?: "asc" | "desc";
  cursor?: string;
};

export async function getUsers(filters: UserFilters = {}) {
  noStore();
  await requireAdmin("users", "read");

  const where: Record<string, any> = {};

  if (filters.search) {
    where.OR = [
      { email: { contains: filters.search } },
      { profile: { username: { contains: filters.search } } },
      { profile: { displayName: { contains: filters.search } } },
    ];
  }

  if (filters.status === "suspended") {
    where.isSuspended = true;
  } else if (filters.status === "banned") {
    where.isBanned = true;
  } else if (filters.status === "verified") {
    where.verifiedBadge = true;
  } else if (filters.status === "pending") {
    where.verifiedBadge = false;
  } else if (filters.status === "active") {
    where.isSuspended = false;
    where.isBanned = false;
  }

  const orderBy: any = {};
  const orderDirection = filters.sortOrder || "desc";

  if (filters.sortBy === "posts") {
    orderBy.posts = { _count: orderDirection };
  } else if (filters.sortBy === "followers") {
    orderBy.followers = { _count: orderDirection };
  } else if (filters.sortBy === "reports") {
    orderBy.reportedReports = { _count: orderDirection };
  } else {
    orderBy.createdAt = orderDirection;
  }

  const users = await prisma.user.findMany({
    where,
    include: {
      profile: true,
      _count: {
        select: {
          followers: true,
          posts: true,
          comments: true,
          following: true,
          reportedReports: true,
        },
      },
    },
    orderBy,
    take: USER_PAGE_SIZE + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });

  const hasMore = users.length > USER_PAGE_SIZE;
  const items = hasMore ? users.slice(0, USER_PAGE_SIZE) : users;
  const lastItem = items[items.length - 1];
  const nextCursor = (hasMore && lastItem) ? lastItem.id : null;

  return { users: items, nextCursor };
}

export async function getUserAdminDetails(userId: string) {
  noStore();
  await requireAdmin("users", "read");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      loginHistory: { orderBy: { createdAt: "desc" }, take: 10 },
      userSessions: { orderBy: { lastActiveAt: "desc" }, take: 10 },
      posts: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          _count: { select: { comments: true, reactions: true } },
        },
      },
      comments: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          post: { select: { id: true, content: true } },
        },
      },
      reactions: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          post: { select: { id: true, content: true } },
          comment: { select: { id: true, content: true } },
        },
      },
      stories: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      reportedReports: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          reporter: {
            select: {
              profile: {
                select: { displayName: true, username: true },
              },
            },
          },
        },
      },
      _count: {
        select: {
          posts: true,
          comments: true,
          followers: true,
          following: true,
          reportedReports: true,
          tipsReceived: true,
        },
      },
    },
  });

  return { user };
}

export async function banUser(userId: string, reason: string) {
  try {
    const ctx = await requireAdmin("users", "write");
    const old = await prisma.user.findUnique({ where: { id: userId }, select: { isBanned: true } });
    await prisma.user.update({ where: { id: userId }, data: { isBanned: true } });
    // Immediately kill all active sessions so the ban takes effect on next request
    await prisma.userSession.deleteMany({ where: { userId } });
    await writeAuditLog(ctx.userId, "BAN_USER", {
      targetType: "User",
      targetId: userId,
      oldValue: { isBanned: old?.isBanned },
      newValue: { isBanned: true, reason },
    });
    revalidatePath("/admin/users", "layout");
    return { success: true };
  } catch (e: any) {
    console.error("[banUser error]", e);
    return { success: false, error: e?.message ?? "Failed to ban user" };
  }
}

export async function checkIpStatus(ip: string) {
  await requireAdmin("users", "read");
  const entry = await prisma.blockedIP.findUnique({ where: { ip } });
  return { blocked: !!entry, entry };
}

export async function banUserIP(userId: string, reason: string) {
  const ctx = await requireAdmin("users", "write");

  // Get user's sessions and login history to get IP addresses
  const [sessions, history] = await Promise.all([
    prisma.userSession.findMany({ where: { userId }, select: { ip: true } }),
    prisma.loginHistory.findMany({ where: { userId }, select: { ip: true } }),
  ]);

  const ips = new Set<string>();
  sessions.forEach((s) => s.ip && ips.add(s.ip));
  history.forEach((h) => h.ip && ips.add(h.ip));

  // Add all to BlockedIP
  for (const ip of ips) {
    try {
      await prisma.blockedIP.upsert({
        where: { ip },
        update: { reason, addedBy: ctx.userId },
        create: { ip, reason, addedBy: ctx.userId },
      });
    } catch (err) {
      console.error("[AdminAction] Failed to block IP:", ip, err);
    }
  }

  // Ban the user account
  await prisma.user.update({ where: { id: userId }, data: { isBanned: true } });

  // Disconnect active sessions
  await prisma.userSession.deleteMany({ where: { userId } });

  await writeAuditLog(ctx.userId, "BAN_USER_AND_IPS", {
    targetType: "User",
    targetId: userId,
    newValue: { isBanned: true, reason, ips: Array.from(ips) },
  });

  revalidatePath("/admin/users", "layout");
  return { success: true };
}

export async function forceUserPasswordReset(userId: string) {
  const ctx = await requireAdmin("users", "write");

  // Set password hash to randomized bypass value
  const forcedVal = "FORCED_RESET_" + Math.random().toString(36).substring(2, 15);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: forcedVal },
  });

  // Logout sessions
  await prisma.userSession.deleteMany({ where: { userId } });

  await writeAuditLog(ctx.userId, "FORCE_PASSWORD_RESET", {
    targetType: "User",
    targetId: userId,
  });

  revalidatePath("/admin/users", "layout");
  return { success: true };
}

export async function terminateUserSessionsAction(userId: string) {
  const ctx = await requireAdmin("users", "write");

  await prisma.userSession.deleteMany({ where: { userId } });

  await writeAuditLog(ctx.userId, "TERMINATE_ALL_USER_SESSIONS", {
    targetType: "User",
    targetId: userId,
  });

  revalidatePath("/admin/users", "layout");
  return { success: true };
}

export async function deviceBanUserAction(userId: string, reason: string) {
  const ctx = await requireAdmin("users", "write");

  // Get active session user-agent info
  const sessions = await prisma.userSession.findMany({
    where: { userId },
    select: { userAgent: true, ip: true },
  });
  const userAgents = sessions.map((s) => s.userAgent).filter(Boolean);

  // Set banned state
  await prisma.user.update({ where: { id: userId }, data: { isBanned: true } });

  // Remove active sessions
  await prisma.userSession.deleteMany({ where: { userId } });

  await writeAuditLog(ctx.userId, "DEVICE_BAN_USER", {
    targetType: "User",
    targetId: userId,
    newValue: { reason, userAgents },
  });

  revalidatePath("/admin/users", "layout");
  return { success: true };
}

export async function unbanUser(userId: string) {
  try {
    const ctx = await requireAdmin("users", "write");
    await prisma.user.update({ where: { id: userId }, data: { isBanned: false } });
    await writeAuditLog(ctx.userId, "UNBAN_USER", { targetType: "User", targetId: userId });
    revalidatePath("/admin/users", "layout");
    return { success: true };
  } catch (e: any) {
    console.error("[unbanUser error]", e);
    return { success: false, error: e?.message ?? "Failed to unban user" };
  }
}

export async function suspendUser(userId: string) {
  try {
    const ctx = await requireAdmin("users", "write");
    await prisma.user.update({ where: { id: userId }, data: { isSuspended: true } });
    // Kill active sessions immediately
    await prisma.userSession.deleteMany({ where: { userId } });
    await writeAuditLog(ctx.userId, "SUSPEND_USER", { targetType: "User", targetId: userId });
    revalidatePath("/admin/users", "layout");
    return { success: true };
  } catch (e: any) {
    console.error("[suspendUser error]", e);
    return { success: false, error: e?.message ?? "Failed to suspend user" };
  }
}

export async function unsuspendUser(userId: string) {
  try {
    const ctx = await requireAdmin("users", "write");
    await prisma.user.update({ where: { id: userId }, data: { isSuspended: false } });
    await writeAuditLog(ctx.userId, "UNSUSPEND_USER", { targetType: "User", targetId: userId });
    revalidatePath("/admin/users", "layout");
    return { success: true };
  } catch (e: any) {
    console.error("[unsuspendUser error]", e);
    return { success: false, error: e?.message ?? "Failed to unsuspend user" };
  }
}

export async function verifyUser(userId: string) {
  const ctx = await requireAdmin("verification", "write");
  const old = await prisma.user.findUnique({ where: { id: userId }, select: { verifiedBadge: true } });
  await prisma.user.update({ where: { id: userId }, data: { verifiedBadge: true } });
  await writeAuditLog(ctx.userId, "VERIFY_USER", {
    targetType: "User",
    targetId: userId,
    oldValue: { verifiedBadge: old?.verifiedBadge },
    newValue: { verifiedBadge: true },
  });
  revalidatePath("/admin/users", "layout");
  revalidatePath("/admin/verification", "layout");
  return { success: true };
}

export async function revokeVerification(userId: string) {
  const ctx = await requireAdmin("verification", "write");
  await prisma.user.update({ where: { id: userId }, data: { verifiedBadge: false } });
  await writeAuditLog(ctx.userId, "REVOKE_VERIFICATION", { targetType: "User", targetId: userId });
  revalidatePath("/admin/users", "layout");
  revalidatePath("/admin/verification", "layout");
  return { success: true };
}

export async function deleteUser(userId: string) {
  const ctx = await requireAdmin("users", "delete");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  await prisma.user.delete({ where: { id: userId } });
  await writeAuditLog(ctx.userId, "DELETE_USER", {
    targetType: "User",
    targetId: userId,
    oldValue: { email: user?.email },
  });
  revalidatePath("/admin/users", "layout");
  return { success: true };
}

export async function toggleAdminStatus(userId: string) {
  const ctx = await requireAdmin("adminManagement", "write");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  if (!user) return { success: false, error: "User not found" };
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isAdmin: !user.isAdmin },
  });
  await writeAuditLog(ctx.userId, "TOGGLE_ADMIN_STATUS", {
    targetType: "User",
    targetId: userId,
    oldValue: { isAdmin: user.isAdmin },
    newValue: { isAdmin: updated.isAdmin },
  });
  revalidatePath("/admin");
  return { success: true, user: updated };
}
