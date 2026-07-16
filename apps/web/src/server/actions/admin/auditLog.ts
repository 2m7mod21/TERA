"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";

export type AuditFilters = {
  adminId?: string;
  action?: string;
  targetType?: string;
  cursor?: string;
};

export async function getAuditLogs(filters: AuditFilters = {}) {
  await requireAdmin("auditLogs", "read");

  const where: Record<string, unknown> = {};
  if (filters.adminId) where.adminId = filters.adminId;
  if (filters.action) where.action = { contains: filters.action };
  if (filters.targetType) where.targetType = filters.targetType;

  const logs = await prisma.adminAuditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 51,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });

  const hasMore = logs.length > 50;
  const items = hasMore ? logs.slice(0, 50) : logs;

  // Fetch admin profiles for display
  const adminIds = [...new Set(items.map((l) => l.adminId))];
  const admins = await prisma.user.findMany({
    where: { id: { in: adminIds } },
    include: { profile: true },
  });
  const adminMap = Object.fromEntries(admins.map((a) => [a.id, a]));

  return {
    logs: items.map((l) => ({ ...l, admin: adminMap[l.adminId] })),
    nextCursor: hasMore ? items[items.length - 1]!.id : null,
  };
}
