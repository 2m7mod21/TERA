import { prisma } from "@/lib/db";
import { UserRepository } from "../repositories/user.repository";

export class FeedService {
  /**
   * Fetch paginated feed posts with cursor pagination and algorithmic or chronological ordering
   */
  static async getFeed(params: {
    userId: string;
    type: "algorithmic" | "chronological";
    limit: number;
    cursor?: string;
  }) {
    const { userId, type, limit, cursor } = params;

    // Get block lists to filter posts
    const blocks = await UserRepository.getBlockList(userId);
    const blockedUserIds = blocks.map((b: any) => b.blockedId);

    // Get following user IDs
    const follows = await UserRepository.getFollowing(userId);
    const followingUserIds = follows.map((f: any) => f.followeeId);

    // General post filters
    const where: any = {
      user: {
        id: { notIn: [userId, ...blockedUserIds] },
      },
      visibility: { in: ["PUBLIC", "FRIENDS"] }, // Filter private posts of others
    };

    // Standard Next.js server component base relations needed for post cards
    const include = {
      user: { include: { profile: true } },
      reactions: true,
      comments: { take: 3, include: { user: { include: { profile: true } } } },
      poll: { include: { options: { include: { votes: true } } } },
      group: true,
      page: true,
    };

    if (type === "chronological") {
      // Simple chronological feed with cursor
      const posts = await prisma.post.findMany({
        where,
        take: limit + 1, // Fetch extra post to see if there is a next page
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
        orderBy: { createdAt: "desc" },
        include,
      });

      const hasNextPage = posts.length > limit;
      const data = hasNextPage ? posts.slice(0, limit) : posts;
      const nextCursor = hasNextPage ? data[data.length - 1]?.id : undefined;

      return {
        posts: data,
        nextCursor,
      };
    } else {
      // Algorithmic feed
      // Formula: Rank = Weight(Recency) + Weight(Engagement) + Weight(Relationship)
      // Since sorting in complex raw SQL isn't database-agnostic, we can fetch candidates, rank them in memory, and slice.
      // Fetch 100 recent posts for ranking
      const candidates = await prisma.post.findMany({
        where,
        take: 100,
        include,
      });

      const now = Date.now();

      const ranked = candidates.map((post: any) => {
        // 1. Recency Score (decaying based on age in hours)
        const ageInHours = (now - post.createdAt.getTime()) / (1000 * 60 * 60);
        const recencyScore = Math.max(0, 100 - ageInHours * 4); // decays by 4 points per hour

        // 2. Engagement Score (reactions + comments count)
        const reactionsCount = post.reactions.length;
        const commentsCount = post.comments.length;
        const engagementScore = reactionsCount * 2 + commentsCount * 5; // comments are weighted higher

        // 3. Relationship Strength
        const isFollowing = followingUserIds.includes(post.userId);
        const relationshipScore = isFollowing ? 50 : 0;

        const totalScore = recencyScore + engagementScore + relationshipScore;

        return { post, score: totalScore };
      });

      // Sort by score desc
      ranked.sort((a: any, b: any) => b.score - a.score);

      // Simple memory-based pagination for the retrieved candidates
      let startIndex = 0;
      if (cursor) {
        startIndex = ranked.findIndex((item: any) => item.post.id === cursor) + 1;
        if (startIndex <= 0) startIndex = 0;
      }

      const paginated = ranked.slice(startIndex, startIndex + limit);
      const data = paginated.map((item: any) => item.post);
      const hasNextPage = startIndex + limit < ranked.length;
      const nextCursor = hasNextPage ? data[data.length - 1]?.id : undefined;

      return {
        posts: data,
        nextCursor,
      };
    }
  }
}
