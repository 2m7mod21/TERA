"use server";

import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db";

// ─── Ranked Feed ──────────────────────────────────────────────────────────────

function freshnessScore(createdAt: Date): number {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  // Exponential decay: half-life = 3 hours
  return Math.pow(0.5, ageHours / 3);
}

function rankPost(post: any, followingIds: Set<string>): number {
  const reactions = post.reactions?.length ?? 0;
  const comments = post._count?.comments ?? 0;
  const freshness = freshnessScore(post.createdAt);

  let score = 0;
  score += reactions * 3;
  score += comments * 5;
  score += freshness * 100;

  // Relationship boost: following the author
  if (followingIds.has(post.userId)) score *= 1.5;

  // Media boost
  try {
    const media = JSON.parse(post.mediaUrls || "[]");
    if (media.length > 0) score *= 1.2;
  } catch { /* ignore */ }

  // Video boost
  if (post.type === "VIDEO") score *= 1.3;

  // Long-form boost
  if ((post.content?.length ?? 0) > 200) score *= 1.1;

  return score;
}

export async function getFeedPosts(cursor?: string, feedType: "foryou" | "recent" = "foryou", limit = 12) {
  const session = await auth();

  const blockedIds = session?.user?.id
    ? await prisma.block
        .findMany({ where: { blockerId: session.user.id }, select: { blockedId: true } })
        .then((r: { blockedId: string }[]) => r.map((b) => b.blockedId))
    : [];

  const followingIds = session?.user?.id
    ? await prisma.follow
        .findMany({ where: { followerId: session.user.id }, select: { followeeId: true } })
        .then((r: { followeeId: string }[]) => new Set(r.map((f) => f.followeeId)))
    : new Set<string>();

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
    reactions: true,
    comments: {
      where: { parentId: null },
      take: 3,
      orderBy: { createdAt: "desc" as const },
      include: { user: { include: { profile: true } } },
    },
    poll: { include: { options: { include: { votes: true } } } },
    _count: { select: { comments: true, reactions: true } },
    shares: { select: { userId: true, content: true } },
    bookmarks: session?.user?.id ? {
      where: { userId: session.user.id },
      select: { id: true },
    } : undefined,
    parentPost: {
      include: {
        user: { include: { profile: true } },
        reactions: true,
        poll: { include: { options: { include: { votes: true } } } },
        shares: { select: { userId: true, content: true } },
        _count: { select: { comments: true, reactions: true } },
      }
    },
  };

  if (feedType === "recent") {
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
    // Fetch a larger pool for ranking then slice
    const pool = await prisma.post.findMany({
      where,
      take: 60,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: { createdAt: "desc" },
      include: commonIncludes,
    });

    // Rank
    const ranked = pool
      .map((p: any) => ({ ...p, _score: rankPost(p, followingIds) }))
      .sort((a: any, b: any) => b._score - a._score);

    const hasMore = ranked.length > limit;
    const data = ranked.slice(0, limit);
    const nextCursor = hasMore ? pool[pool.length - 1]?.id : null;

    return { posts: data, nextCursor };
  }
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
}

// ─── Trending Hashtags ────────────────────────────────────────────────────────

export async function getTrendingTopics(limit = 8) {
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
      reactions: true,
      _count: { select: { comments: true, reactions: true } },
    },
  });

  const hasMore = posts.length > limit;
  const data = posts.slice(0, limit);
  const nextCursor = hasMore ? data[data.length - 1]?.id : null;

  return { posts: data, nextCursor };
}
