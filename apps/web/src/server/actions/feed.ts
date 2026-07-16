"use server";

import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db";
import { FeedEngine } from "@/server/services/feed-engine/feed-engine.service";
import { getOrSet, CacheKeys } from "@/lib/cache";

// ─── Ranked Feed ──────────────────────────────────────────────────────────────

export async function getFeedPosts(
  cursor?: string,
  feedType: "foryou" | "recent" = "foryou",
  limit = 12,
  sessionContext?: { deviceType?: "mobile" | "desktop"; sessionDurationSec?: number }
) {
  const session = await auth();

  const blockedIds = session?.user?.id
    ? await prisma.block
        .findMany({ where: { blockerId: session.user.id }, select: { blockedId: true } })
        .then((r: { blockedId: string }[]) => r.map((b) => b.blockedId))
    : [];

  // Visibility logic: Author can always see their own posts of any visibility. Others can see PUBLIC and FRIENDS.
  const where: any = {
    AND: [
      {
        OR: [
          { visibility: { in: ["PUBLIC", "FRIENDS"] } },
          ...(session?.user?.id ? [{ userId: session.user.id }] : []),
        ],
      },
      ...(blockedIds.length > 0 ? [{ user: { id: { notIn: blockedIds } } }] : []),
      // Filter out hidden posts
      ...(session?.user?.id ? [{
        hiddenBy: { none: { userId: session.user.id } }
      }] : []),
    ],
  };

  const commonIncludes = {
    user: { include: { profile: true } },
    reactions: session?.user?.id ? {
      where: { userId: session.user.id },
      select: { type: true, userId: true },
      take: 1,
    } : undefined,
    comments: {
      where: { parentId: null },
      take: 3,
      orderBy: { createdAt: "desc" as const },
      include: { user: { include: { profile: true } } },
    },
    poll: { include: { options: { include: { votes: true } } } },
    _count: { select: { comments: true, reactions: true, shares: true } },
    shares: session?.user?.id ? {
      where: { userId: session.user.id },
      select: { userId: true, content: true },
      take: 1,
    } : undefined,
    bookmarks: session?.user?.id ? {
      where: { userId: session.user.id },
      select: { id: true },
    } : undefined,
    parentPost: {
      include: {
        user: { include: { profile: true } },
        reactions: session?.user?.id ? {
          where: { userId: session.user.id },
          select: { type: true, userId: true },
          take: 1,
        } : undefined,
        poll: { include: { options: { include: { votes: true } } } },
        shares: session?.user?.id ? {
          where: { userId: session.user.id },
          select: { userId: true, content: true },
          take: 1,
        } : undefined,
        _count: { select: { comments: true, reactions: true, shares: true } },
      }
    },
  };

  const cacheKey = CacheKeys.feed(session?.user?.id ?? "anonymous", feedType, cursor ?? null);
  
  return getOrSet(cacheKey, 30, async () => {
    if (feedType === "recent") {
      // ── Recent mode: strict chronological, NEVER altered by algorithm ──
      const posts = await prisma.post.findMany({
        where,
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
        orderBy: { createdAt: "desc" },
        include: commonIncludes,
      });

      const hasMore = posts.length > limit;
      const data = posts.slice(0, limit);
      const nextCursor = hasMore ? posts[limit - 1]?.id : null;

      return { posts: data, nextCursor };
    } else {
      // ── For You mode: two-stage recommendation engine ──
      if (!session?.user?.id) {
        // Unauthenticated fallback: simple recent feed from trending candidates
        const posts = await prisma.post.findMany({
          where,
          take: limit + 1,
          cursor: cursor ? { id: cursor } : undefined,
          skip: cursor ? 1 : 0,
          orderBy: { createdAt: "desc" },
          include: commonIncludes,
        });
        const hasMore = posts.length > limit;
        const data = posts.slice(0, limit);
        return { posts: data, nextCursor: hasMore ? data[data.length - 1]?.id : null };
      }

      try {
        const rankedPosts = await FeedEngine.getRankedFeed(
          session.user.id,
          limit,
          sessionContext
        );

        // Note: cursor-based pagination is handled by the candidate pool size.
        // For production, pass cursor into candidateGenerator to offset queries.
        return {
          posts: rankedPosts,
          nextCursor: rankedPosts.length >= limit ? rankedPosts[rankedPosts.length - 1]?.id ?? null : null,
        };
      } catch (error) {
        console.error("[FeedEngine] Error in getRankedFeed, falling back to recent:", error);
        // Graceful fallback to recency
        const posts = await prisma.post.findMany({
          where,
          take: limit + 1,
          cursor: cursor ? { id: cursor } : undefined,
          skip: cursor ? 1 : 0,
          orderBy: { createdAt: "desc" },
          include: commonIncludes,
        });
        const hasMore = posts.length > limit;
        const data = posts.slice(0, limit);
        return { posts: data, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null };
      }
    }
  });
}


// ─── Suggested Users ──────────────────────────────────────────────────────────

export async function getSuggestedUsers(limit = 6) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const myId = session.user.id;

  // My following ids
  const myFollowing = await prisma.follow
    .findMany({ where: { followerId: myId }, select: { followeeId: true } })
    .then((r: { followeeId: string }[]) => r.map((f) => f.followeeId));

  const excludeIds = [...myFollowing, myId];

  const cacheKey = CacheKeys.suggestedUsers(myId);

  return getOrSet(cacheKey, 120, async () => {
    // Candidate users I do not follow yet
    const candidates = await prisma.user.findMany({
      where: { id: { notIn: excludeIds } },
      take: 50,
      include: {
        profile: true,
        followers: { select: { followerId: true } },
      },
    });

    // Score by mutual follows
    const scored = candidates.map((u: any) => {
      const theirFollowerIds = new Set(u.followers.map((f: any) => f.followerId));
      const mutualCount = myFollowing.filter((id: string) => theirFollowerIds.has(id)).length;
      return { ...u, mutualCount, _score: mutualCount * 10 + u.followers.length };
    });

    return scored
      .sort((a: any, b: any) => b._score - a._score)
      .slice(0, limit);
  });
}

// ─── Trending Hashtags ────────────────────────────────────────────────────────

export async function getTrendingTopics(limit = 8) {
  return getOrSet(CacheKeys.trending(), 300, async () => {
    const since = new Date(Date.now() - 24 * 3_600_000);
    const posts = await prisma.post.findMany({
      where: { createdAt: { gte: since }, visibility: "PUBLIC" },
      select: { content: true },
    });

    const counts: Record<string, number> = {};
    for (const p of posts) {
      const tags = (p.content?.match(/#\w+/g) ?? []) as string[];
      tags.forEach((t: string) => { counts[t] = (counts[t] ?? 0) + 1; });
    }

    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }));
  });
}

// ─── Active Friends ───────────────────────────────────────────────────────────

export async function getActiveFriends(limit = 8) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const since = new Date(Date.now() - 60 * 60_000); // last hour
  const following = await prisma.follow.findMany({
    where: { followerId: session.user.id },
    select: { followeeId: true },
  });
  const ids = following.map((f: { followeeId: string }) => f.followeeId);

  if (ids.length === 0) return [];

  const cacheKey = CacheKeys.activeFriends(session.user.id);

  return getOrSet(cacheKey, 60, async () => {
    const recentActivity = await prisma.post.findMany({
      where: { userId: { in: ids }, createdAt: { gte: since } },
      select: { userId: true },
      distinct: ["userId"],
      take: limit,
    });

    const activeIds = recentActivity.map((p: { userId: string }) => p.userId);
    if (activeIds.length === 0) return [];

    return prisma.user.findMany({
      where: { id: { in: activeIds } },
      select: { id: true, profile: { select: { displayName: true, avatarUrl: true, username: true } } },
      take: limit,
    });
  });
}

// ─── Video Posts (Watch Page) ─────────────────────────────────────────────────

export async function getVideoPosts(cursor?: string, limit = 12) {
  const session = await auth();

  const blockedIds = session?.user?.id
    ? await prisma.block
        .findMany({ where: { blockerId: session.user.id }, select: { blockedId: true } })
        .then((r: { blockedId: string }[]) => r.map((b) => b.blockedId))
    : [];

  const where: any = {
    type: "VIDEO",
    visibility: { in: ["PUBLIC", "FRIENDS"] },
    ...(blockedIds.length > 0 ? { user: { id: { notIn: blockedIds } } } : {}),
  };

  const posts = await prisma.post.findMany({
    where,
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    orderBy: { createdAt: "desc" },
    include: {
      user: { include: { profile: true } },
      reactions: session?.user?.id ? {
        where: { userId: session.user.id },
        select: { type: true, userId: true },
        take: 1,
      } : undefined,
      _count: { select: { comments: true, reactions: true } },
    },
  });

  const hasMore = posts.length > limit;
  const data = posts.slice(0, limit);
  const nextCursor = hasMore ? data[data.length - 1]?.id : null;

  return { posts: data, nextCursor };
}
