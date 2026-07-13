"use server";

import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createNotification } from "./notifications";


export async function reportPost(postId: string, reason: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const report = await prisma.report.create({
      data: {
        reporterId: session.user.id,
        contentType: "POST",
        contentId: postId,
        postId,
        reason,
        status: "PENDING",
      },
    });

    // Automatically trigger AI-flagging/Moderation Queue entry
    await prisma.moderationQueue.create({
      data: {
        entityType: "POST",
        entityId: postId,
        flagReason: `User reported: ${reason}`,
        aiFlagged: false,
        decision: "PENDING",
      },
    });

    return { success: true, report };
  } catch (error) {
    console.error("Report post error:", error);
    return { success: false, error: "Failed to submit report" };
  }
}

export async function getPendingModerationQueue() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return [];
  }

  try {
    return prisma.moderationQueue.findMany({
      where: { decision: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Get moderation queue error:", error);
    return [];
  }
}

export async function moderateContent(queueId: string, decision: "APPROVE" | "BLOCK" | "DELETE") {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await prisma.$transaction(async (tx: any) => {
      const entry = await tx.moderationQueue.update({
        where: { id: queueId },
        data: {
          decision,
          moderatorId: session.user.id,
        },
      });

      if (decision === "DELETE") {
        if (entry.entityType === "POST") {
          await tx.post.delete({ where: { id: entry.entityId } });
        } else if (entry.entityType === "COMMENT") {
          await tx.comment.delete({ where: { id: entry.entityId } });
        }
      }
    });

    revalidatePath("/admin/moderation");
    return { success: true };
  } catch (error) {
    console.error("Moderate content error:", error);
    return { success: false, error: "Failed to apply decision" };
  }
}

/**
 * GDPR Data Export Action
 * Generates an export payload containing all user information from the database.
 */
export async function exportUserData() {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        profile: true,
        posts: true,
        comments: true,
        reactions: true,
        bookmarks: {
          include: { post: true },
        },
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Prepare JSON payload for export
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt,
      },
      profile: user.profile,
      posts: user.posts.map((p: any) => ({
        id: p.id,
        content: p.content,
        type: p.type,
        mediaUrls: p.mediaUrls,
        createdAt: p.createdAt,
      })),
      comments: user.comments.map((c: any) => ({
        id: c.id,
        postId: c.postId,
        content: c.content,
        createdAt: c.createdAt,
      })),
      reactions: user.reactions.map((r: any) => ({
        id: r.id,
        postId: r.postId,
        commentId: r.commentId,
        type: r.type,
        createdAt: r.createdAt,
      })),
      bookmarks: user.bookmarks.map((b: any) => ({
        createdAt: b.createdAt,
        post: {
          id: b.post.id,
          content: b.post.content,
        },
      })),
    };

    return { success: true, data: JSON.stringify(exportPayload, null, 2) };
  } catch (error) {
    console.error("GDPR export error:", error);
    return { success: false, error: "Failed to export data" };
  }
}

export async function logViolationAction(
  userId: string,
  data: {
    contentType: "POST" | "COMMENT" | "REPLY" | "BIO" | "USERNAME";
    contentId?: string;
    violationType: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    matchedWords: string[];
  }
) {
  try {
    // Count active user violations to determine the current strike number
    const activeViolationsCount = await prisma.userViolation.count({
      where: { userId, isActive: true },
    });
    const strikeNumber = activeViolationsCount + 1;

    let actionTaken = "WARNING";
    let expiresAt: Date | null = null;
    let message = "Your account has received a warning due to content policy violations.";

    if (strikeNumber === 2) {
      actionTaken = "FEATURE_RESTRICT";
      message = "Some actions have been restricted on your account due to repeated violations.";
    } else if (strikeNumber === 3) {
      actionTaken = "TEMP_SUSPEND";
      // 72 hours suspension
      expiresAt = new Date(Date.now() + 72 * 3600 * 1000);
      message = "Your account has been suspended for 72 hours due to multiple policy violations.";
      
      // Enforce suspension and clear login sessions immediately
      await prisma.user.update({
        where: { id: userId },
        data: { isSuspended: true },
      });
      await prisma.userSession.deleteMany({
        where: { userId },
      });
    } else if (strikeNumber >= 4) {
      actionTaken = "PERM_BAN";
      message = "Your account has been permanently banned due to persistent policy violations.";
      
      // Enforce perm ban and clear sessions
      await prisma.user.update({
        where: { id: userId },
        data: { isBanned: true, isSuspended: true },
      });
      await prisma.userSession.deleteMany({
        where: { userId },
      });
    }

    // Log the violation
    const violation = await prisma.userViolation.create({
      data: {
        userId,
        violationType: data.violationType,
        severity: data.severity,
        strikeNumber,
        actionTaken,
        expiresAt,
        contentType: data.contentType,
        contentId: data.contentId || null,
        matchedWords: data.matchedWords.join(", "),
        isActive: true,
      },
    });

    // Send a system/security notification alert to the user
    await createNotification({
      receiverId: userId,
      type: strikeNumber >= 3 ? "SECURITY_ALERT" : "SYSTEM",
      entityType: "REPORT",
      entityId: violation.id,
      priority: strikeNumber >= 4 ? 100 : strikeNumber === 3 ? 90 : 50,
      metadata: JSON.stringify({
        action: actionTaken,
        strikeNumber,
        message,
      }),
    });

    return {
      success: true,
      violationId: violation.id,
      strikeNumber,
      actionTaken,
      expiresAt,
    };
  } catch (error) {
    console.error("[logViolationAction error]", error);
    return { success: false, error: "Failed to record violation strike" };
  }
}

