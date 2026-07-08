"use server";

import { prisma } from "@/lib/db";
import { requireAdmin, writeAuditLog } from "@/lib/adminAuth";
import { revalidatePath } from "next/cache";

const USER_PAGE_SIZE = 25;

export type UserFilters = {
  search?: string;
  status?: "active" | "suspended" | "banned" | "verified";
  cursor?: string;
};

export async function getUsers(filters: UserFilters = {}) {
  await requireAdmin("users", "read");

  const where: Record<string, unknown> = {};

  if (filters.search) {
    where.OR = [
      { email: { contains: filters.search } },
      { profile: { username: { contains: filters.search } } },
      { profile: { displayName: { contains: filters.search } } },
    ];
  }

  if (filters.status === "suspended") where.isSuspended = true;
  else if (filters.status === "banned") where.isBanned = true;
  else if (filters.status === "verified") where.verifiedBadge = true;
  else if (filters.status === "active") {
    where.isSuspended = false;
    where.isBanned = false;
  }

  const users = await prisma.user.findMany({
    where,
    include: {
      profile: true,
      _count: { select: { followers: true, posts: true } },
    },
    orderBy: { createdAt: "desc" },
    take: USER_PAGE_SIZE + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });

  const hasMore = users.length > USER_PAGE_SIZE;
  const items = hasMore ? users.slice(0, USER_PAGE_SIZE) : users;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { users: items, nextCursor };
}

export async function banUser(userId: string, reason: string) {
  const ctx = await requireAdmin("users", "write");
  const old = await prisma.user.findUnique({ where: { id: userId }, select: { isBanned: true } });

  await prisma.user.update({ where: { id: userId }, data: { isBanned: true } });
  await writeAuditLog(ctx.userId, "BAN_USER", {
    targetType: "User",
    targetId: userId,
    oldValue: { isBanned: old?.isBanned },
    newValue: { isBanned: true, reason },
  });
  revalidatePath("/admin/users");
  return { success: true };
}

export async function unbanUser(userId: string) {
  const ctx = await requireAdmin("users", "write");
  await prisma.user.update({ where: { id: userId }, data: { isBanned: false } });
  await writeAuditLog(ctx.userId, "UNBAN_USER", { targetType: "User", targetId: userId });
  revalidatePath("/admin/users");
  return { success: true };
}

export async function suspendUser(userId: string) {
  const ctx = await requireAdmin("users", "write");
  await prisma.user.update({ where: { id: userId }, data: { isSuspended: true } });
  await writeAuditLog(ctx.userId, "SUSPEND_USER", { targetType: "User", targetId: userId });
  revalidatePath("/admin/users");
  return { success: true };
}

export async function unsuspendUser(userId: string) {
  const ctx = await requireAdmin("users", "write");
  await prisma.user.update({ where: { id: userId }, data: { isSuspended: false } });
  await writeAuditLog(ctx.userId, "UNSUSPEND_USER", { targetType: "User", targetId: userId });
  revalidatePath("/admin/users");
  return { success: true };
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
  revalidatePath("/admin/users");
  revalidatePath("/admin/verification");
  return { success: true };
}

export async function revokeVerification(userId: string) {
  const ctx = await requireAdmin("verification", "write");
  await prisma.user.update({ where: { id: userId }, data: { verifiedBadge: false } });
  await writeAuditLog(ctx.userId, "REVOKE_VERIFICATION", { targetType: "User", targetId: userId });
  revalidatePath("/admin/verification");
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
  revalidatePath("/admin/users");
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
