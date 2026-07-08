import { prisma } from "@/lib/db";

export class TrendingService {
  /**
   * Returns hashtags sorted by usage count
   */
  static async getTrendingHashtags(limit = 5) {
    try {
      // Direct query from computed TrendingHashtag model
      const trending = await (prisma as any).trendingHashtag.findMany({
        orderBy: { count: "desc" },
        take: limit,
      });

      if (trending.length > 0) return trending;

      // Fallback: dynamic compute from posts
      const recentPosts = await prisma.post.findMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) }, // past 48 hours
        },
        select: { content: true },
      });

      const tagsMap: Record<string, number> = {};
      recentPosts.forEach((post) => {
        if (!post.content) return;
        const tags = post.content.match(/#\w+/g);
        if (tags) {
          tags.forEach((tag) => {
            const clean = tag.toLowerCase();
            tagsMap[clean] = (tagsMap[clean] || 0) + 1;
          });
        }
      });

      return Object.entries(tagsMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (error) {
      console.error("getTrendingHashtags error:", error);
      return [];
    }
  }

  /**
   * Retrieves posts with high engagement (likes, comments, views) in the last 48 hours
   */
  static async getTrendingPosts(limit = 5) {
    try {
      const posts = await prisma.post.findMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
          visibility: "PUBLIC",
        },
        include: {
          user: { include: { profile: true } },
          reactions: true,
          _count: { select: { comments: true } },
        },
        take: 50,
      });

      // Score posts based on reactions + comments
      const scored = posts.map((post) => {
        const reactions = post.reactions.length;
        const comments = post._count?.comments || 0;
        return {
          post,
          score: reactions * 2 + comments * 5,
        };
      });

      return scored
        .sort((a, b) => b.score - a.score)
        .map((x) => x.post)
        .slice(0, limit);
    } catch (error) {
      console.error("getTrendingPosts error:", error);
      return [];
    }
  }
}
