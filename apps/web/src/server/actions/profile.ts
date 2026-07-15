"use server";

import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

import { ModerationService } from "@/services/moderation";
import { logViolationAction } from "./moderation";

// ─── Update basic profile fields ─────────────────────────────────────────────
export async function updateProfile(data: {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  websiteUrl?: string;
  location?: string;
  relationshipStatus?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const modSetting = await prisma.platformSetting.findUnique({
      where: { key: "moderation_action" }
    });
    const moderationAction = modSetting?.value || "BLOCK";

    let cleanBio = data.bio;
    let cleanDisplayName = data.displayName;
    let bioViolation = null;
    let nameViolation = null;

    if (data.bio) {
      const bioResult = await ModerationService.checkText(data.bio);
      if (!bioResult.allowed) {
        if (moderationAction === "BLOCK") {
          await logViolationAction(session.user.id, {
            contentType: "BIO",
            violationType: bioResult.reason || "PROFANITY",
            severity: bioResult.severity || "LOW",
            matchedWords: bioResult.matchedWords,
          });
          return { success: false, error: "Bio contains prohibited words." };
        } else if (moderationAction === "REPLACE") {
          cleanBio = bioResult.cleanText;
          data.bio = cleanBio;
        }
        bioViolation = bioResult;
      }
    }

    if (data.displayName) {
      const nameResult = await ModerationService.checkText(data.displayName);
      if (!nameResult.allowed) {
        if (moderationAction === "BLOCK") {
          await logViolationAction(session.user.id, {
            contentType: "USERNAME",
            violationType: nameResult.reason || "PROFANITY",
            severity: nameResult.severity || "LOW",
            matchedWords: nameResult.matchedWords,
          });
          return { success: false, error: "Display name contains prohibited words." };
        } else if (moderationAction === "REPLACE") {
          cleanDisplayName = nameResult.cleanText;
          data.displayName = cleanDisplayName;
        }
        nameViolation = nameResult;
      }
    }

    await prisma.profile.update({ where: { userId: session.user.id }, data });

    if (bioViolation) {
      await logViolationAction(session.user.id, {
        contentType: "BIO",
        violationType: bioViolation.reason || "PROFANITY",
        severity: bioViolation.severity || "LOW",
        matchedWords: bioViolation.matchedWords,
      });
    }

    if (nameViolation) {
      await logViolationAction(session.user.id, {
        contentType: "USERNAME",
        violationType: nameViolation.reason || "PROFANITY",
        severity: nameViolation.severity || "LOW",
        matchedWords: nameViolation.matchedWords,
      });
    }

    const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
    revalidatePath(`/${profile?.username}`);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Update profile Action error:", error);
    return { success: false, error: "Failed to update profile" };
  }
}

// ─── Update About sub-sections ───────────────────────────────────────────────
export async function updateAbout(data: {
  education?: string;  // JSON stringified
  work?: string;
  skills?: string;
  languages?: string;
  interests?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await prisma.profile.update({ where: { userId: session.user.id }, data });
    const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
    revalidatePath(`/${profile?.username}`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update about" };
  }
}

// ─── Pinned posts ─────────────────────────────────────────────────────────────
export async function pinPost(postId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    // Unpin all existing (max 3 enforced by UI)
    const pinned = await (prisma.post as any).count({
      where: { userId: session.user.id, isPinned: true },
    });
    if (pinned >= 3) return { success: false, error: "Maximum 3 pinned posts allowed" };

    await (prisma.post as any).update({
      where: { id: postId, userId: session.user.id },
      data: { isPinned: true },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to pin post" };
  }
}

export async function unpinPost(postId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await (prisma.post as any).update({
      where: { id: postId, userId: session.user.id },
      data: { isPinned: false },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to unpin post" };
  }
}

export async function getPinnedPosts(userId: string) {
  return (prisma.post as any).findMany({
    where: { userId, isPinned: true },
    orderBy: { updatedAt: "desc" },
    take: 3,
    include: {
      user: { include: { profile: true } },
      reactions: true,
      _count: { select: { comments: true } },
    },
  });
}

// ─── Profile tab data helpers ─────────────────────────────────────────────────
export async function getProfilePhotos(userId: string, viewerId: string | null) {
  const isOwner = viewerId === userId;
  const posts = await prisma.post.findMany({
    where: {
      userId,
      type: { in: ["IMAGE", "CAROUSEL"] },
      visibility: isOwner ? undefined : "PUBLIC",
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return posts.flatMap((p) => {
    try { return JSON.parse(p.mediaUrls) as string[]; } catch { return []; }
  });
}

export async function getProfileVideos(userId: string, viewerId: string | null) {
  const isOwner = viewerId === userId;
  return prisma.post.findMany({
    where: {
      userId,
      type: "VIDEO",
      visibility: isOwner ? undefined : "PUBLIC",
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
