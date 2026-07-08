"use server";

import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function reportPost(postId: string, reason: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const report = await prisma.report.create({
      data: {
        reporterId: session.user.id,
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
