"use server";

import { prisma } from "@/lib/db";
import { requireAdmin, writeAuditLog } from "@/lib/adminAuth";
import { createNotification } from "@/server/actions/notifications";
import { revalidatePath } from "next/cache";

const PAGE_SIZE = 25;

// ── Shared include for full report data ────────────────────────────────────────
const REPORT_INCLUDE = {
  reporter: { include: { profile: true } },
  reportedUser: { include: { profile: true } },
  assignedModerator: { include: { profile: true } },
  post: {
    include: {
      user: { include: { profile: true } },
      _count: { select: { reports: true } },
    },
  },
  actions: {
    include: { admin: { include: { profile: true } } },
    orderBy: { createdAt: "desc" as const },
    take: 20,
  },
  violations: { take: 5, orderBy: { createdAt: "desc" as const } },
} as const;

// ── Stats ───────────────────────────────────────────────────────────────────────
export async function getReportsStats() {
  await requireAdmin("reports", "read");

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [total, pending, underReview, resolved, ignored, critical, today, avgResolution] =
    await Promise.all([
      prisma.report.count(),
      prisma.report.count({ where: { status: "PENDING" } }),
      prisma.report.count({ where: { status: "UNDER_REVIEW" } }),
      prisma.report.count({ where: { status: "RESOLVED" } }),
      prisma.report.count({ where: { status: "IGNORED" } }),
      prisma.report.count({ where: { priority: "CRITICAL" } }),
      prisma.report.count({ where: { createdAt: { gte: todayStart } } }),
      // Avg resolution time in hours (resolved reports only)
      prisma.report
        .findMany({
          where: { status: "RESOLVED", resolvedAt: { not: null } },
          select: { createdAt: true, resolvedAt: true },
          take: 500,
        })
        .then((reports) => {
          if (reports.length === 0) return 0;
          const hours = reports.map((r) =>
            r.resolvedAt
              ? (r.resolvedAt.getTime() - r.createdAt.getTime()) / 3_600_000
              : 0
          );
          return Math.round(hours.reduce((a, b) => a + b, 0) / hours.length);
        }),
    ]);

  return { total, pending, underReview, resolved, ignored, critical, today, avgResolution };
}

// ── List reports with full filters ─────────────────────────────────────────────
export async function getReports(filters?: {
  status?: string;
  priority?: string;
  contentType?: string;
  category?: string;
  assignedTo?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "createdAt" | "priority" | "updatedAt";
  sortDir?: "asc" | "desc";
  cursor?: string;
}) {
  await requireAdmin("reports", "read");

  const {
    status,
    priority,
    contentType,
    category,
    assignedTo,
    search,
    dateFrom,
    dateTo,
    sortBy = "createdAt",
    sortDir = "desc",
    cursor,
  } = filters ?? {};

  const where: any = {
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(contentType ? { contentType } : {}),
    ...(category ? { category } : {}),
    ...(assignedTo === "unassigned"
      ? { assignedModeratorId: null }
      : assignedTo
      ? { assignedModeratorId: assignedTo }
      : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { reason: { contains: search } },
            { details: { contains: search } },
            { reporter: { profile: { username: { contains: search } } } },
            { reportedUser: { profile: { username: { contains: search } } } },
          ],
        }
      : {}),
  };

  // Build orderBy — priority ordering is string-based: CRITICAL > HIGH > MEDIUM > LOW
  const orderBy: any[] =
    sortBy === "priority"
      ? [{ priority: sortDir }, { createdAt: "desc" }]
      : [{ [sortBy]: sortDir }];

  const reports = await prisma.report.findMany({
    where,
    include: REPORT_INCLUDE,
    orderBy,
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = reports.length > PAGE_SIZE;
  const items = hasMore ? reports.slice(0, PAGE_SIZE) : reports;
  return { reports: items, nextCursor: hasMore ? items[items.length - 1].id : null };
}

// ── Single report detail ────────────────────────────────────────────────────────
export async function getReportDetail(reportId: string) {
  await requireAdmin("reports", "read");

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      ...REPORT_INCLUDE,
      reportedUser: {
        include: {
          profile: true,
          _count: {
            select: {
              posts: true,
              reports: true,       // reports submitted by them
              reportedReports: true, // reports against them
              violations: true,
            },
          },
        },
      },
    },
  });

  if (!report) return null;

  // Fetch violation history & appeals for the reported user
  const [violations, appeals] = report.reportedUserId
    ? await Promise.all([
        prisma.userViolation.findMany({
          where: { userId: report.reportedUserId },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { appeal: true },
        }),
        prisma.appeal.findMany({
          where: { userId: report.reportedUserId },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { reviewer: { include: { profile: true } } },
        }),
      ])
    : [[], []];

  // Fetch reported content based on contentType
  let content: any = null;
  try {
    if (report.contentType === "POST" && report.contentId) {
      content = await prisma.post.findUnique({
        where: { id: report.contentId },
        include: {
          user: { include: { profile: true } },
          reactions: true,
          _count: { select: { comments: true, reactions: true } },
        },
      });
    } else if (report.contentType === "COMMENT" && report.contentId) {
      content = await (prisma as any).comment.findUnique({
        where: { id: report.contentId },
        include: { user: { include: { profile: true } } },
      });
    } else if (report.contentType === "USER" && report.contentId) {
      content = await prisma.profile.findUnique({
        where: { userId: report.contentId },
      });
    }
  } catch {}

  return { report, violations, appeals, content };
}

// ── Assign report to a moderator ───────────────────────────────────────────────
export async function assignReport(reportId: string, moderatorId: string) {
  const ctx = await requireAdmin("reports", "write");

  await prisma.report.update({
    where: { id: reportId },
    data: { status: "UNDER_REVIEW", assignedModeratorId: moderatorId },
  });

  await prisma.reportAction.create({
    data: {
      reportId,
      adminId: ctx.userId,
      actionType: "ASSIGNED",
      notes: `Assigned to moderator ${moderatorId}`,
    },
  });

  await writeAuditLog(ctx.userId, "REPORT_ASSIGNED", {
    targetType: "Report",
    targetId: reportId,
    newValue: { assignedTo: moderatorId },
  });

  revalidatePath("/admin/reports");
  return { success: true };
}

// ── Resolve / dismiss report ───────────────────────────────────────────────────
export async function resolveReport(
  reportId: string,
  decision: "RESOLVED" | "IGNORED",
  reason?: string
) {
  const ctx = await requireAdmin("reports", "write");

  await prisma.report.update({
    where: { id: reportId },
    data: { status: decision, resolvedAt: new Date() },
  });

  await prisma.reportAction.create({
    data: {
      reportId,
      adminId: ctx.userId,
      actionType: decision === "RESOLVED" ? "DISMISSED" : "DISMISSED",
      reason: reason ?? null,
    },
  });

  await writeAuditLog(ctx.userId, `REPORT_${decision}`, {
    targetType: "Report",
    targetId: reportId,
    newValue: { status: decision, reason },
  });

  revalidatePath("/admin/reports");
  return { success: true };
}

// ── Content moderation actions ─────────────────────────────────────────────────
export async function moderateContent(
  reportId: string,
  action: "DELETE" | "HIDE" | "RESTORE" | "MARK_SAFE",
  reason: string,
  targetPostId?: string,
  targetCommentId?: string
) {
  const ctx = await requireAdmin("reports", "write");

  const actionTypeMap: Record<string, string> = {
    DELETE: "CONTENT_DELETED",
    HIDE: "CONTENT_HIDDEN",
    RESTORE: "CONTENT_RESTORED",
    MARK_SAFE: "DISMISSED",
  };

  if (action === "DELETE") {
    if (targetPostId) {
      await prisma.post.delete({ where: { id: targetPostId } });
    } else if (targetCommentId) {
      await (prisma as any).comment.delete({ where: { id: targetCommentId } });
    }
  } else if (action === "HIDE" && targetPostId) {
    await prisma.post.update({
      where: { id: targetPostId },
      data: { visibility: "PRIVATE" },
    });
  } else if (action === "RESTORE" && targetPostId) {
    await prisma.post.update({
      where: { id: targetPostId },
      data: { visibility: "PUBLIC" },
    });
  }

  await prisma.report.update({
    where: { id: reportId },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });

  await prisma.reportAction.create({
    data: {
      reportId,
      adminId: ctx.userId,
      actionType: actionTypeMap[action],
      reason,
    },
  });

  await writeAuditLog(ctx.userId, `CONTENT_${action}_VIA_REPORT`, {
    targetType: "Report",
    targetId: reportId,
    newValue: { action, reason, targetPostId, targetCommentId },
  });

  revalidatePath("/admin/reports");
  return { success: true };
}

// ── User moderation actions with strike system ─────────────────────────────────
export async function moderateUser(
  reportId: string,
  targetUserId: string,
  action: "WARN" | "RESTRICT" | "SUSPEND" | "BAN",
  reason: string,
  violationType: string = "OTHER",
  duration?: number // hours for temp suspension
) {
  const ctx = await requireAdmin("reports", "write");

  const actionTypeMap: Record<string, string> = {
    WARN: "USER_WARNED",
    RESTRICT: "USER_RESTRICTED",
    SUSPEND: "USER_SUSPENDED",
    BAN: "USER_BANNED",
  };

  // Calculate current strike number
  const existingStrikes = await prisma.userViolation.count({
    where: { userId: targetUserId },
  });
  const strikeNumber = existingStrikes + 1;

  // Determine severity based on strike number
  const severity =
    strikeNumber >= 4 ? "CRITICAL" : strikeNumber >= 3 ? "HIGH" : strikeNumber >= 2 ? "MEDIUM" : "LOW";

  // Apply action to user
  if (action === "SUSPEND") {
    const expiresAt = duration ? new Date(Date.now() + duration * 3_600_000) : null;
    await prisma.user.update({
      where: { id: targetUserId },
      data: { isSuspended: true },
    });
    // Create violation
    await prisma.userViolation.create({
      data: {
        userId: targetUserId,
        reportId,
        violationType,
        severity,
        strikeNumber,
        actionTaken: "TEMP_SUSPEND",
        expiresAt,
        issuedBy: ctx.userId,
      },
    });
  } else if (action === "BAN") {
    await prisma.user.update({
      where: { id: targetUserId },
      data: { isBanned: true, isSuspended: true },
    });
    await prisma.userViolation.create({
      data: {
        userId: targetUserId,
        reportId,
        violationType,
        severity: "CRITICAL",
        strikeNumber,
        actionTaken: "PERM_BAN",
        issuedBy: ctx.userId,
      },
    });
  } else if (action === "RESTRICT") {
    await prisma.userViolation.create({
      data: {
        userId: targetUserId,
        reportId,
        violationType,
        severity,
        strikeNumber,
        actionTaken: "FEATURE_RESTRICT",
        issuedBy: ctx.userId,
      },
    });
  } else {
    // WARN
    await prisma.userViolation.create({
      data: {
        userId: targetUserId,
        reportId,
        violationType,
        severity,
        strikeNumber,
        actionTaken: "WARNING",
        issuedBy: ctx.userId,
      },
    });
  }

  // Resolve the report
  await prisma.report.update({
    where: { id: reportId },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });

  await prisma.reportAction.create({
    data: {
      reportId,
      adminId: ctx.userId,
      actionType: actionTypeMap[action],
      reason,
      metadata: JSON.stringify({ strikeNumber, severity, violationType }),
    },
  });

  // Notify the user
  await createNotification({
    receiverId: targetUserId,
    type: action === "BAN" || action === "SUSPEND" ? "SECURITY_ALERT" : "SYSTEM",
    entityType: "REPORT",
    entityId: reportId,
    priority: action === "BAN" ? 100 : action === "SUSPEND" ? 90 : 50,
    metadata: JSON.stringify({
      action,
      reason,
      strikeNumber,
      message:
        action === "WARN"
          ? "Your account has received a warning."
          : action === "RESTRICT"
          ? "Some features have been restricted on your account."
          : action === "SUSPEND"
          ? `Your account has been suspended${duration ? ` for ${duration} hours` : ""}.`
          : "Your account has been permanently banned.",
    }),
  });

  await writeAuditLog(ctx.userId, `USER_${action}_VIA_REPORT`, {
    targetType: "User",
    targetId: targetUserId,
    newValue: { action, reason, strikeNumber, reportId },
  });

  revalidatePath("/admin/reports");
  revalidatePath("/admin/users");
  return { success: true, strikeNumber };
}

// ── User violation history ─────────────────────────────────────────────────────
export async function getUserViolationHistory(userId: string) {
  await requireAdmin("reports", "read");

  const [violations, reportsAgainst, reportsMade] = await Promise.all([
    prisma.userViolation.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { report: true, appeal: true },
    }),
    prisma.report.count({ where: { reportedUserId: userId } }),
    prisma.report.count({ where: { reporterId: userId } }),
  ]);

  return { violations, reportsAgainst, reportsMade };
}

// ── Appeals management ─────────────────────────────────────────────────────────
export async function getAppeals(filters?: {
  status?: string;
  cursor?: string;
}) {
  await requireAdmin("reports", "read");
  const { status, cursor } = filters ?? {};

  const appeals = await prisma.appeal.findMany({
    where: status ? { status } : {},
    include: {
      user: { include: { profile: true } },
      violation: { include: { report: true } },
      reviewer: { include: { profile: true } },
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = appeals.length > PAGE_SIZE;
  const items = hasMore ? appeals.slice(0, PAGE_SIZE) : appeals;
  return { appeals: items, nextCursor: hasMore ? items[items.length - 1].id : null };
}

export async function reviewAppeal(
  appealId: string,
  decision: "APPROVED" | "REJECTED",
  note: string
) {
  const ctx = await requireAdmin("reports", "write");

  const appeal = await prisma.appeal.update({
    where: { id: appealId },
    data: {
      status: decision,
      reviewedBy: ctx.userId,
      reviewNote: note,
      reviewedAt: new Date(),
    },
    include: { violation: true, user: true },
  });

  // If approved, lift the punishment
  if (decision === "APPROVED") {
    await prisma.userViolation.update({
      where: { id: appeal.violationId },
      data: { isActive: false },
    });

    // If it was a suspension/ban, restore user access
    const action = appeal.violation.actionTaken;
    if (action === "TEMP_SUSPEND" || action === "PERM_BAN") {
      await prisma.user.update({
        where: { id: appeal.userId },
        data: {
          isSuspended: false,
          ...(action === "PERM_BAN" ? { isBanned: false } : {}),
        },
      });
    }
  }

  // Log action on the linked report
  if (appeal.violation.reportId) {
    await prisma.reportAction.create({
      data: {
        reportId: appeal.violation.reportId,
        adminId: ctx.userId,
        actionType: decision === "APPROVED" ? "APPEAL_APPROVED" : "APPEAL_REJECTED",
        reason: note,
      },
    });
  }

  // Notify user
  await createNotification({
    receiverId: appeal.userId,
    type: "SYSTEM",
    entityType: "APPEAL",
    entityId: appealId,
    priority: 80,
    metadata: JSON.stringify({
      decision,
      note,
      message:
        decision === "APPROVED"
          ? "Your appeal has been approved. Restrictions have been lifted."
          : `Your appeal has been rejected: ${note}`,
    }),
  });

  await writeAuditLog(ctx.userId, `APPEAL_${decision}`, {
    targetType: "Appeal",
    targetId: appealId,
    newValue: { decision, note },
  });

  revalidatePath("/admin/reports/appeals");
  return { success: true };
}

// ── Legacy compatibility ───────────────────────────────────────────────────────
export async function acceptReportAndAct(
  reportId: string,
  consequence: "DELETE_CONTENT" | "WARN_USER" | "SUSPEND_USER",
  targetUserId?: string,
  targetPostId?: string
) {
  if (consequence === "DELETE_CONTENT") {
    return moderateContent(reportId, "DELETE", "Accepted via admin", targetPostId);
  } else if (consequence === "WARN_USER" && targetUserId) {
    return moderateUser(reportId, targetUserId, "WARN", "Warning issued via report");
  } else if (consequence === "SUSPEND_USER" && targetUserId) {
    return moderateUser(reportId, targetUserId, "SUSPEND", "Suspension via report", "OTHER", 72);
  }
  return { success: false };
}

// ── AI Moderation Queue (unchanged) ───────────────────────────────────────────
export async function getModerationQueue(cursor?: string) {
  await requireAdmin("aiModeration", "read");

  const items = await prisma.moderationQueue.findMany({
    where: { decision: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > PAGE_SIZE;
  const entries = hasMore ? items.slice(0, PAGE_SIZE) : items;
  return { items: entries, nextCursor: hasMore ? entries[entries.length - 1].id : null };
}

export async function moderationDecision(
  itemId: string,
  decision: "APPROVE" | "BLOCK" | "DELETE" | "WARN"
) {
  const ctx = await requireAdmin("aiModeration", "write");

  await prisma.moderationQueue.update({
    where: { id: itemId },
    data: { decision, moderatorId: ctx.userId },
  });

  await writeAuditLog(ctx.userId, `AI_MOD_${decision}`, {
    targetType: "ModerationQueue",
    targetId: itemId,
    newValue: { decision },
  });

  revalidatePath("/admin/ai-moderation");
  return { success: true };
}
