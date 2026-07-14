import { prisma } from "@/lib/db";

export interface CandidateWrapper {
  post: any;
  sources: string[];
}

export class CandidateGenerator {
  /**
   * Helper that builds standard includes needed for rendering with PostCard
   */
  static getCommonIncludes(viewerId: string | null) {
    return {
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
      bookmarks: viewerId ? {
        where: { userId: viewerId },
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
  }

  /**
   * Source 1: Following/Circle pool
   * Pulls posts from users whom the viewer follows.
   */
  static async getFollowingCandidates(viewerId: string): Promise<CandidateWrapper[]> {
    const follows = await prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followeeId: true },
    });
    
    const followingIds = follows.map((f) => f.followeeId);
    if (followingIds.length === 0) return [];

    const posts = await prisma.post.findMany({
      where: {
        userId: { in: followingIds },
        visibility: { in: ["PUBLIC", "FRIENDS"] },
        user: {
          isSuspended: false,
          isBanned: false,
        },
        hiddenBy: { none: { userId: viewerId } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: this.getCommonIncludes(viewerId),
    });

    return posts.map((p) => ({ post: p, sources: ["following"] }));
  }

  /**
   * Source 2: Content-Based Interest Match
   * Pulls posts matching viewer's topic interests/affinities.
   */
  static async getContentMatchCandidates(viewerId: string): Promise<CandidateWrapper[]> {
    // 1. Gather viewer topic interests
    const userTopics = await (prisma as any).topicAffinity.findMany({
      where: { userId: viewerId, score: { gt: 0 } },
      orderBy: { score: "desc" },
      select: { topic: true },
      take: 10,
    });
    
    const topics = userTopics.map((t: any) => t.topic.toLowerCase());

    // 2. Add profile interests
    const profile = await prisma.profile.findUnique({
      where: { userId: viewerId },
      select: { interests: true },
    });
    if (profile?.interests) {
      try {
        const parsed = JSON.parse(profile.interests);
        if (Array.isArray(parsed)) {
          parsed.forEach((t: string) => {
            const clean = t.toLowerCase();
            if (!topics.includes(clean)) topics.push(clean);
          });
        }
      } catch {}
    }

    if (topics.length === 0) return [];

    // 3. Find posts matching those topic hashtags (excluding creator self)
    const posts = await prisma.post.findMany({
      where: {
        userId: { not: viewerId },
        visibility: "PUBLIC",
        user: {
          isSuspended: false,
          isBanned: false,
        },
        hashtags: {
          some: {
            hashtag: {
              name: { in: topics },
            },
          },
        },
        hiddenBy: { none: { userId: viewerId } },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: this.getCommonIncludes(viewerId),
    });

    return posts.map((p) => ({ post: p, sources: ["content-match"] }));
  }

  /**
   * Source 3: Collaborative Filtering
   * Posts engaged with by friends/strong-affinity users, or friends-of-friends.
   */
  static async getCollaborativeCandidates(viewerId: string): Promise<CandidateWrapper[]> {
    // 1. Get users followed by this viewer
    const follows = await prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followeeId: true },
    });
    const followingIds = follows.map((f) => f.followeeId);
    if (followingIds.length === 0) return [];

    // 2. Identify top posts liked or commented by followees in the last 7 days
    const recentEngagementCutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    
    const reactions = await prisma.reaction.findMany({
      where: {
        userId: { in: followingIds },
        createdAt: { gte: recentEngagementCutoff },
        postId: { not: null },
      },
      select: { postId: true },
      take: 50,
    });

    const comments = await prisma.comment.findMany({
      where: {
        userId: { in: followingIds },
        createdAt: { gte: recentEngagementCutoff },
        postId: { not: null },
      },
      select: { postId: true },
      take: 50,
    });

    const postIds = Array.from(
      new Set([
        ...reactions.map((r) => r.postId as string),
        ...comments.map((c) => c.postId as string),
      ])
    );

    if (postIds.length === 0) return [];

    // 3. Fetch these posts (exclude posts viewer already created or followed users' own baseline to prevent duplication)
    const posts = await prisma.post.findMany({
      where: {
        id: { in: postIds },
        userId: { notIn: [viewerId, ...followingIds] },
        visibility: "PUBLIC",
        user: {
          isSuspended: false,
          isBanned: false,
        },
        hiddenBy: { none: { userId: viewerId } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: this.getCommonIncludes(viewerId),
    });

    return posts.map((p) => ({ post: p, sources: ["collaborative"] }));
  }

  /**
   * Source 4: Trending Injection
   * Currently high-velocity posts/topics.
   */
  static async getTrendingCandidates(viewerId: string | null): Promise<CandidateWrapper[]> {
    // 1. Get high-velocity hashtags
    const hashtags = await prisma.trendingHashtag.findMany({
      orderBy: { velocityScore: "desc" },
      select: { name: true },
      take: 5,
    });
    const trendingTags = hashtags.map((h) => h.name.toLowerCase());

    const recentCutoff = new Date(Date.now() - 3 * 24 * 3600 * 1000);

    // 2. Fetch posts meeting trending criteria (highly viewed, shared, or matching hashtags)
    const posts = await prisma.post.findMany({
      where: {
        visibility: "PUBLIC",
        user: {
          isSuspended: false,
          isBanned: false,
        },
        createdAt: { gte: recentCutoff },
        OR: [
          {
            hashtags: {
              some: {
                hashtag: {
                  name: { in: trendingTags },
                },
              },
            },
          },
          { viewCount: { gte: 20 } },
          { shareCount: { gte: 1 } },
        ],
        ...(viewerId ? {
          userId: { not: viewerId },
          hiddenBy: { none: { userId: viewerId } },
        } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: this.getCommonIncludes(viewerId),
    });

    return posts.map((p) => ({ post: p, sources: ["trending"] }));
  }

  /**
   * Source 5: Creator Cold-Start
   * Recent posts from new or low-history creators matching viewer's interests.
   */
  static async getColdStartCandidates(viewerId: string): Promise<CandidateWrapper[]> {
    // 1. Identify low-follower or new creators (e.g. follow count < 20)
    // We check CreatorTrust profile or do user counting directly.
    const newCreators = await prisma.user.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) }, // created in last 30 days
        isSuspended: false,
        isBanned: false,
        id: { not: viewerId },
      },
      select: { id: true },
      take: 50,
    });

    const creatorIds = newCreators.map((c) => c.id);
    if (creatorIds.length === 0) return [];

    // 2. Get topics user is interested in to target exposure
    const userTopics = await (prisma as any).topicAffinity.findMany({
      where: { userId: viewerId, score: { gt: 0 } },
      select: { topic: true },
      take: 10,
    });
    const topics = userTopics.map((t: any) => t.topic.toLowerCase());

    const recentCutoff = new Date(Date.now() - 5 * 24 * 3600 * 1000);

    const posts = await prisma.post.findMany({
      where: {
        userId: { in: creatorIds },
        visibility: "PUBLIC",
        createdAt: { gte: recentCutoff },
        // If topics are defined, require matching hashtag, otherwise retrieve any cold posts
        ...(topics.length > 0 ? {
          hashtags: {
            some: {
              hashtag: {
                name: { in: topics },
              },
            },
          },
        } : {}),
        hiddenBy: { none: { userId: viewerId } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: this.getCommonIncludes(viewerId),
    });

    return posts.map((p) => ({ post: p, sources: ["cold-start"] }));
  }

  /**
   * Merge and deduplicate candidates from various pools.
   */
  static mergeCandidates(pools: CandidateWrapper[][]): CandidateWrapper[] {
    const map = new Map<string, CandidateWrapper>();

    for (const pool of pools) {
      for (const wrapper of pool) {
        const id = wrapper.post.id;
        const existing = map.get(id);
        if (existing) {
          // Merge source tags
          for (const src of wrapper.sources) {
            if (!existing.sources.includes(src)) {
              existing.sources.push(src);
            }
          }
        } else {
          // Clone wrapper structure
          map.set(id, {
            post: wrapper.post,
            sources: [...wrapper.sources],
          });
        }
      }
    }

    return Array.from(map.values());
  }
}
