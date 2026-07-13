"use server";

import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db";
import { createNotification } from "./notifications";
import { emitNotification } from "@/server/socket/index";
import { extractMentionUsernames as extractMentionUsernamesSync } from "./mentions-utils";

// ─── ANTI-SPAM CONSTANTS ──────────────────────────────────────────────────────
const MAX_MENTIONS_PER_POST = 10;
const SPAM_WINDOW_MS = 60_000; // 1 minute
const SPAM_THRESHOLD = 20; // max mentions in 1 minute

// ─── MENTION AUTOCOMPLETE ─────────────────────────────────────────────────────
/**
 * Real-time user search for @mention autocomplete.
 * Returns ranked results: people you follow first, then verified, then popular.
 */
export async function searchUsersForMention(query: string, limit = 8) {
  const session = await auth();
  const currentUserId = session?.user?.id ?? null;

  const q = query.trim().toLowerCase();
  if (!q) return { users: [] };

  try {
    // Run all queries in parallel
    const [followingIds, rawUsers] = await Promise.all([
      // Get who current user follows
      currentUserId
        ? prisma.follow
            .findMany({
              where: { followerId: currentUserId },
              select: { followeeId: true },
            })
            .then((f) => f.map((x) => x.followeeId))
        : Promise.resolve<string[]>([]),

      // Search users by username/displayName (SQLite contains is case-insensitive by default)
      prisma.profile.findMany({
        where: {
          user: { isBanned: false, isSuspended: false },
          OR: [
            { username: { contains: q } },
            { displayName: { contains: q } },
          ],
          ...(currentUserId ? { NOT: { userId: currentUserId } } : {}),
        },
        include: {
          user: {
            select: { id: true, verifiedBadge: true, isVerified: true },
          },
        },
        take: 30,
      }),
    ]);

    // Rank results intelligently
    const ranked = rawUsers
      .map((p) => {
        let score = 0;
        const uname = p.username.toLowerCase();
        const dname = p.displayName.toLowerCase();

        // Exact match
        if (uname === q || dname === q) score += 100;
        // Starts with
        else if (uname.startsWith(q) || dname.startsWith(q)) score += 60;
        // Contains
        else score += 20;

        // Following boost
        if (followingIds.includes(p.userId)) score += 80;

        // Verified boost
        if (p.user.verifiedBadge || p.user.isVerified) score += 30;

        return { profile: p, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ profile: p }) => ({
        id: p.userId,
        username: p.username,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        isVerified: p.user.verifiedBadge || p.user.isVerified,
        isFollowing: followingIds.includes(p.userId),
      }));

    return { users: ranked };
  } catch (error) {
    console.error("searchUsersForMention error:", error);
    return { users: [] };
  }
}

// ─── EXTRACT MENTIONS FROM TEXT ───────────────────────────────────────────────
// NOTE: moved to "./mentions-utils" because this file has "use server",
// and Next.js requires every export from a "use server" file to be async.
// Re-exported here (as an async wrapper) only so existing imports of
// `extractMentionUsernames` from this file keep working without changes.
import { extractMentionUsernames as _extractMentionUsernames } from "./mentions-utils";
export async function extractMentionUsernames(text: string): Promise<string[]> {
  return _extractMentionUsernames(text);
}

// ─── ANTI-SPAM CHECK ──────────────────────────────────────────────────────────
async function isSpamming(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - SPAM_WINDOW_MS);
  const count = await prisma.mention.count({
    where: { authorId: userId, createdAt: { gte: since } },
  });
  return count >= SPAM_THRESHOLD;
}

// ─── CHECK MENTION PERMISSION ─────────────────────────────────────────────────
async function canMention(
  authorId: string,
  targetUserId: string
): Promise<boolean> {
  const profile = await prisma.profile.findUnique({
    where: { userId: targetUserId },
    select: { mentionPrivacy: true },
  });

  if (!profile) return false;
  if (profile.mentionPrivacy === "NOBODY") return false;
  if (profile.mentionPrivacy === "EVERYONE") return true;

  // FOLLOWING: only people target follows can mention them
  if (profile.mentionPrivacy === "FOLLOWING") {
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followeeId: {
          followerId: targetUserId,
          followeeId: authorId,
        },
      },
    });
    return !!follow;
  }

  return true;
}

// ─── PERSIST MENTIONS IN DB ───────────────────────────────────────────────────
export async function persistMentions(
  text: string,
  authorId: string,
  context: { postId?: string; commentId?: string; storyId?: string },
  maxAllowed = MAX_MENTIONS_PER_POST
) {
  const usernames = extractMentionUsernamesSync(text).slice(0, maxAllowed);
  if (!usernames.length) return;

  // Anti-spam
  if (await isSpamming(authorId)) {
    console.warn(`[Mentions] User ${authorId} is spamming mentions.`);
    return;
  }

  const profiles = await prisma.profile.findMany({
    where: { username: { in: usernames }, NOT: { userId: authorId } },
    select: { userId: true, username: true },
  });

  let excludeUserId: string | null = null;
  if (context.commentId) {
    try {
      const comment = await prisma.comment.findUnique({
        where: { id: context.commentId },
        include: {
          post: { select: { userId: true } },
          parent: { select: { userId: true } },
        },
      });
      if (comment) {
        if (comment.parentId) {
          excludeUserId = comment.parent?.userId ?? null;
        } else {
          excludeUserId = comment.post?.userId ?? null;
        }
      }
    } catch (e) {
      console.error("Error fetching comment details for bypass:", e);
    }
  }

  for (const profile of profiles) {
    const allowed = await canMention(authorId, profile.userId);
    if (!allowed) continue;

    // Only notify if this mention record was actually newly created.
    // If it already existed (duplicate), skip the notification so we
    // don't spam the mentioned user on every edit/re-save.
    let created = true;
    try {
      await prisma.mention.create({
        data: {
          mentionedId: profile.userId,
          authorId,
          postId: context.postId ?? null,
          commentId: context.commentId ?? null,
          storyId: context.storyId ?? null,
        },
      });
    } catch {
      created = false; // duplicate, skip
    }

    if (!created) continue;
    if (profile.userId === excludeUserId) continue;

    // Notification
    const entityType = context.postId
      ? "POST"
      : context.commentId
      ? "COMMENT"
      : "STORY";
    const entityId =
      context.postId ?? context.commentId ?? context.storyId ?? "";
    const notifType = context.storyId ? "STORY_MENTION" : "MENTION";

    const n = await createNotification({
      receiverId: profile.userId,
      senderId: authorId,
      type: notifType,
      entityId,
      entityType,
      priority: 1,
      metadata: JSON.stringify({
        postId: context.postId,
        commentId: context.commentId,
        storyId: context.storyId,
      }),
    });
    if (n) emitNotification(profile.userId, n);
  }
}

// ─── GET USER'S MENTION HISTORY ───────────────────────────────────────────────
export async function getMyMentions(cursor?: string, limit = 20) {
  const session = await auth();
  if (!session?.user?.id) return { mentions: [], nextCursor: null };

  try {
    const items = await prisma.mention.findMany({
      where: { mentionedId: session.user.id },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      include: {
        author: { include: { profile: true } },
        post: { select: { id: true, content: true, type: true } },
        comment: { select: { id: true, content: true } },
        story: { select: { id: true, type: true, textContent: true } },
      },
    });

    const hasMore = items.length > limit;
    const mentions = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? (mentions[mentions.length - 1]?.id ?? null) : null;

    return { mentions, nextCursor };
  } catch (error) {
    console.error("getMyMentions error:", error);
    return { mentions: [], nextCursor: null };
  }
}

// ─── UPDATE MENTION PRIVACY ───────────────────────────────────────────────────
export async function updateMentionPrivacy(
  privacy: "EVERYONE" | "FOLLOWING" | "NOBODY"
) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await prisma.profile.update({
      where: { userId: session.user.id },
      data: { mentionPrivacy: privacy },
    });
    return { success: true };
  } catch (error) {
    console.error("updateMentionPrivacy error:", error);
    return { success: false, error: "Failed to update mention privacy" };
  }
}

// ─── GET MENTION PRIVACY ──────────────────────────────────────────────────────
export async function getMentionPrivacy() {
  const session = await auth();
  if (!session?.user?.id) return "EVERYONE";

  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { mentionPrivacy: true },
    });
    return (profile?.mentionPrivacy ?? "EVERYONE") as "EVERYONE" | "FOLLOWING" | "NOBODY";
  } catch {
    return "EVERYONE";
  }
}

// ─── IMAGE TAGGING ────────────────────────────────────────────────────────────
export async function tagUsersInImage(
  postId: string,
  tags: { userId: string; x: number; y: number }[]
) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    // Verify post ownership
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });
    if (!post || post.userId !== session.user.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Resolve which tags are actually allowed BEFORE touching the DB,
    // so we never end up deleting the old tags and failing to replace them.
    const limitedTags = tags.slice(0, 20);
    const allowedTags: typeof limitedTags = [];
    for (const tag of limitedTags) {
      const allowed = await canMention(session.user.id, tag.userId);
      if (allowed) allowedTags.push(tag);
    }

    // Replace old tags with new ones atomically.
    await prisma.$transaction([
      prisma.imageTag.deleteMany({ where: { postId } }),
      ...allowedTags.map((tag) =>
        prisma.imageTag.upsert({
          where: { postId_userId: { postId, userId: tag.userId } },
          update: { x: tag.x, y: tag.y },
          create: { postId, userId: tag.userId, x: tag.x, y: tag.y },
        })
      ),
    ]);

    // Notify tagged users after the transaction succeeds.
    for (const tag of allowedTags) {
      const n = await createNotification({
        receiverId: tag.userId,
        senderId: session.user.id,
        type: "TAG",
        entityId: postId,
        entityType: "POST",
        priority: 1,
      });
      if (n) emitNotification(tag.userId, n);
    }

    return { success: true };
  } catch (error) {
    console.error("tagUsersInImage error:", error);
    return { success: false, error: "Failed to tag users" };
  }
}

// ─── GET IMAGE TAGS FOR POST ──────────────────────────────────────────────────
export async function getImageTags(postId: string) {
  try {
    const tags = await prisma.imageTag.findMany({
      where: { postId },
      include: {
        user: {
          include: { profile: { select: { username: true, displayName: true, avatarUrl: true } } },
        },
      },
    });
    return { success: true, tags };
  } catch {
    return { success: true, tags: [] };
  }
}

// ─── ADMIN: MENTION STATS ─────────────────────────────────────────────────────
export async function getAdminMentionStats(limit = 20) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!user?.isAdmin) return null;

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalMentions, recentMentions, topAbusers] = await Promise.all([
      prisma.mention.count(),
      prisma.mention.count({ where: { createdAt: { gte: since } } }),
      prisma.mention.groupBy({
        by: ["authorId"],
        where: { createdAt: { gte: since } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: limit,
      }),
    ]);

    // Enrich with user data
    const authorIds = topAbusers.map((a: any) => a.authorId);
    const users = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      include: { profile: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const abusers = topAbusers.map((a: any) => ({
      userId: a.authorId,
      mentionCount: a._count.id,
      user: userMap[a.authorId],
    }));

    return { totalMentions, recentMentions, abusers };
  } catch (error) {
    console.error("getAdminMentionStats error:", error);
    return null;
  }
}
