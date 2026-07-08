"use server";

import { prisma } from "@/lib/db";
import { requireAdmin, writeAuditLog } from "@/lib/adminAuth";
import { revalidatePath } from "next/cache";

// ── Security Center ───────────────────────────────────────────

export async function getFailedLogins(cursor?: string) {
  await requireAdmin("security", "read");

  const items = await prisma.loginHistory.findMany({
    where: { success: false },
    include: { user: { include: { profile: true } } },
    orderBy: { createdAt: "desc" },
    take: 26,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > 25;
  const entries = hasMore ? items.slice(0, 25) : items;
  return { items: entries, nextCursor: hasMore ? entries[entries.length - 1].id : null };
}

export async function getActiveSessions(userId?: string) {
  await requireAdmin("security", "read");

  return prisma.userSession.findMany({
    where: {
      expiresAt: { gt: new Date() },
      ...(userId ? { userId } : {}),
    },
    include: { user: { include: { profile: true } } },
    orderBy: { lastActiveAt: "desc" },
    take: 50,
  });
}

export async function terminateSession(sessionId: string) {
  const ctx = await requireAdmin("security", "write");
  const session = await prisma.userSession.findUnique({ where: { id: sessionId } });
  await prisma.userSession.delete({ where: { id: sessionId } });
  await writeAuditLog(ctx.userId, "TERMINATE_SESSION", {
    targetType: "UserSession",
    targetId: sessionId,
    oldValue: { userId: session?.userId },
  });
  revalidatePath("/admin/security");
  return { success: true };
}

export async function getBlockedIPs() {
  await requireAdmin("security", "read");
  return prisma.blockedIP.findMany({ orderBy: { createdAt: "desc" } });
}

export async function addBlockedIP(ip: string, reason?: string) {
  const ctx = await requireAdmin("security", "write");
  await prisma.blockedIP.create({ data: { ip, reason, addedBy: ctx.userId } });
  await writeAuditLog(ctx.userId, "BLOCK_IP", { targetType: "BlockedIP", newValue: { ip, reason } });
  revalidatePath("/admin/security");
  return { success: true };
}

export async function removeBlockedIP(id: string) {
  const ctx = await requireAdmin("security", "delete");
  const entry = await prisma.blockedIP.findUnique({ where: { id } });
  await prisma.blockedIP.delete({ where: { id } });
  await writeAuditLog(ctx.userId, "UNBLOCK_IP", { targetType: "BlockedIP", oldValue: { ip: entry?.ip } });
  revalidatePath("/admin/security");
  return { success: true };
}

// ── Admin Management ──────────────────────────────────────────

export async function getAdmins() {
  await requireAdmin("adminManagement", "read");
  return prisma.adminUser.findMany({
    include: { user: { include: { profile: true } }, role: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getAdminRoles() {
  await requireAdmin("adminManagement", "read");
  return prisma.adminRole.findMany({ orderBy: { name: "asc" } });
}

export async function inviteAdmin(userId: string, roleId: string) {
  const ctx = await requireAdmin("adminManagement", "write");
  const newAdmin = await prisma.adminUser.create({
    data: { userId, roleId, invitedBy: ctx.userId },
    include: { role: true },
  });
  await writeAuditLog(ctx.userId, "INVITE_ADMIN", {
    targetType: "AdminUser",
    targetId: userId,
    newValue: { role: newAdmin.role.name },
  });
  revalidatePath("/admin/admin-management");
  return { success: true };
}

export async function changeAdminRole(adminUserId: string, roleId: string) {
  const ctx = await requireAdmin("adminManagement", "write");
  const old = await prisma.adminUser.findUnique({
    where: { id: adminUserId },
    include: { role: true },
  });
  const updated = await prisma.adminUser.update({
    where: { id: adminUserId },
    data: { roleId },
    include: { role: true },
  });
  await writeAuditLog(ctx.userId, "CHANGE_ADMIN_ROLE", {
    targetType: "AdminUser",
    targetId: adminUserId,
    oldValue: { role: old?.role.name },
    newValue: { role: updated.role.name },
  });
  revalidatePath("/admin/admin-management");
  return { success: true };
}

export async function removeAdmin(adminUserId: string) {
  const ctx = await requireAdmin("adminManagement", "delete");

  // Prevent self-removal
  const admin = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
  if (admin?.userId === ctx.userId) {
    return { success: false, error: "Cannot remove yourself" };
  }

  await prisma.adminUser.delete({ where: { id: adminUserId } });
  await writeAuditLog(ctx.userId, "REMOVE_ADMIN", { targetType: "AdminUser", targetId: adminUserId });
  revalidatePath("/admin/admin-management");
  return { success: true };
}

export async function updateRolePermissions(roleId: string, permissions: object) {
  const ctx = await requireAdmin("adminManagement", "write");

  // Only OWNER can edit permissions
  if (ctx.role !== "OWNER") {
    return { success: false, error: "Only Owners can edit permission matrix" };
  }

  const old = await prisma.adminRole.findUnique({ where: { id: roleId } });
  await prisma.adminRole.update({
    where: { id: roleId },
    data: { permissions: JSON.stringify(permissions) },
  });

  await writeAuditLog(ctx.userId, "UPDATE_ROLE_PERMISSIONS", {
    targetType: "AdminRole",
    targetId: roleId,
    oldValue: old?.permissions ? JSON.parse(old.permissions) : {},
    newValue: permissions,
  });

  revalidatePath("/admin/admin-management");
  return { success: true };
}
