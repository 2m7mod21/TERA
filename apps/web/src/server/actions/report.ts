"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/server/auth/config";
import { createNotification } from "@/server/actions/notifications";
import { z } from "zod";

// ── Validation schema ──────────────────────────────────────────────────────────
const reportSchema = z.object({
  contentType: z.enum(["POST", "COMMENT", "MESSAGE", "USER", "STORY", "REEL", "IMAGE", "VIDEO"]),
  contentId: z.string().min(1),
  reportedUserId: z.string().optional(),
  category: z.enum(["SAFETY", "ABUSE", "SPAM", "FRAUD", "SEXUAL", "IP", "OTHER"]),
  reason: z.string().min(3).max(120),
  details: z.string().max(1000).optional(),
  attachments: z.array(z.object({ url: z.string(), type: z.string() })).max(5).optional(),
});

// Priority mapping
const PRIORITY_MAP: Record<string, string> = {
  // SAFETY
  VIOLENCE: "CRITICAL",
  THREATS: "CRITICAL",
  TERRORISM: "CRITICAL",
  SELF_HARM: "CRITICAL",
  // ABUSE
  HARASSMENT: "HIGH",
  HATE_SPEECH: "HIGH",
  BULLYING: "HIGH",
  // FRAUD
  SCAM: "HIGH",
  PHISHING: "HIGH",
  // SEXUAL
  NUDITY: "HIGH",
  SEXUAL_EXPLOITATION: "CRITICAL",
  // SPAM
  SPAM: "MEDIUM",
  FAKE_ENGAGEMENT: "MEDIUM",
  BOT_ACTIVITY: "MEDIUM",
  // IP
  COPYRIGHT: "MEDIUM",
  TRADEMARK: "LOW",
  // DEFAULT
  OTHER: "LOW",
};

function getPriority(reason: string): string {
  const key = reason.toUpperCase().replace(/\s+/g, "_");
  return PRIORITY_MAP[key] ?? "MEDIUM";
}

// ── Submit a report (with rate limiting & dupe check) ─────────────────────────
export async function submitReport(data: z.infer<typeof reportSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const parsed = reportSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const { contentType, contentId, reportedUserId, category, reason, details, attachments } =
    parsed.data;

  const reporterId = session.user.id;

  // Rate limiting: max 10 reports per hour
  const oneHourAgo = new Date(Date.now() - 3_600_000);
  const recentCount = await prisma.report.count({
    where: { reporterId, createdAt: { gte: oneHourAgo } },
  });
  if (recentCount >= 10) {
    return { success: false, error: "You've submitted too many reports recently. Please try again later." };
  }

  // Duplicate prevention: same (reporter, contentType, contentId) in last 24h
  const dayAgo = new Date(Date.now() - 86_400_000);
  const duplicate = await prisma.report.findFirst({
    where: { reporterId, contentType, contentId, createdAt: { gte: dayAgo } },
  });
  if (duplicate) {
    return { success: false, error: "You've already reported this content recently." };
  }

  try {
    const priority = getPriority(reason);
    
    // Also set postId for backward compat if content is a post
    const postId = contentType === "POST" ? contentId : undefined;

    const report = await prisma.report.create({
      data: {
        reporterId,
        reportedUserId: reportedUserId ?? null,
        contentType,
        contentId,
        postId: postId ?? null,
        category,
        reason,
        details: details ?? null,
        attachments: JSON.stringify(attachments ?? []),
        priority,
        status: "PENDING",
      },
    });

    // Send reporter a confirmation notification
    try {
      await createNotification({
        receiverId: reporterId,
        type: "SYSTEM",
        entityType: "REPORT",
        entityId: report.id,
        priority: 0,
        metadata: JSON.stringify({
          message: "Your report has been submitted and will be reviewed by our team.",
          reportId: report.id,
        }),
      });
    } catch (notifErr) {
      console.error("Error creating report confirmation notification:", notifErr);
    }

    // Notify all admins for CRITICAL reports
    if (priority === "CRITICAL") {
      try {
        const admins = await prisma.adminUser.findMany({
          select: { userId: true },
        });
        await Promise.allSettled(
          admins.map((a) =>
            createNotification({
              receiverId: a.userId,
              type: "ADMIN",
              entityType: "REPORT",
              entityId: report.id,
              priority: 100,
              metadata: JSON.stringify({
                message: `🚨 Critical report submitted: ${reason}`,
                reportId: report.id,
              }),
            })
          )
        );
      } catch (adminNotifErr) {
        console.error("Error notifying admins for critical report:", adminNotifErr);
      }
    }

    return { success: true, reportId: report.id };
  } catch (error: any) {
    console.error("submitReport Action server-side error:", error);
    return { success: false, error: error.message || "Database write error occurred." };
  }
}

// ── Get current user's submitted reports ──────────────────────────────────────
export async function getMyReports() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.report.findMany({
    where: { reporterId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      contentType: true,
      reason: true,
      category: true,
      status: true,
      priority: true,
      createdAt: true,
    },
  });
}

// ── Get current user's violations (for profile/settings page) ─────────────────
export async function getMyViolations() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.userViolation.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { appeal: { select: { id: true, status: true } } },
  });
}

// ── Submit an appeal against a violation ──────────────────────────────────────
export async function submitAppeal(
  violationId: string,
  reason: string,
  explanation: string
) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  if (!reason.trim() || !explanation.trim()) {
    return { success: false, error: "Reason and explanation are required." };
  }
  if (explanation.length < 20) {
    return { success: false, error: "Please provide a more detailed explanation (min 20 chars)." };
  }

  // Verify violation belongs to this user and doesn't already have an appeal
  const violation = await prisma.userViolation.findFirst({
    where: { id: violationId, userId: session.user.id },
    include: { appeal: true },
  });

  if (!violation) return { success: false, error: "Violation not found." };
  if (violation.appeal) return { success: false, error: "You've already submitted an appeal for this violation." };

  const appeal = await prisma.appeal.create({
    data: {
      userId: session.user.id,
      violationId,
      reason,
      explanation,
      status: "PENDING",
    },
  });

  return { success: true, appealId: appeal.id };
}
