import { prisma } from "@/lib/db";

export class QualityScorer {
  /**
   * Get the cached or recomputed quality multiplier for a post [0, 1].
   * If cache is missing or stale (> 1 hour), recomputes automatically.
   */
  static async getQualityScore(postId: string, forceRecompute = false): Promise<number> {
    try {
      const cache = await prisma.postQualityCache.findUnique({
        where: { postId },
      });

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      if (cache && !forceRecompute && cache.updatedAt > oneHourAgo) {
        return cache.qualityScore;
      }

      // Recompute and cache
      return await this.recomputePostQuality(postId);
    } catch (error) {
      console.error("Error retrieving quality score:", error);
      return 1.0; // Fallback to neutral
    }
  }

  /**
   * Recompute post quality score and write to cache.
   * Scans creator trust, moderation warnings, and engagement spikes.
   */
  static async recomputePostQuality(postId: string): Promise<number> {
    try {
      // 1. Fetch Post, author, violations, and reports
      const post: any = await prisma.post.findUnique({
        where: { id: postId },
        include: {
          user: {
            include: {
              creatorTrust: true,
              violations: { where: { isActive: true } },
            },
          },
        },
      });

      if (!post) return 0.0;

      // 2. Check hard moderation exclusions
      // If the creator is suspended or banned
      if (post.user.isSuspended || post.user.isBanned) {
        await this.writeCache(postId, 0.0, { suspension: true });
        return 0.0;
      }

      // Check current moderation queue decisions
      const modQueueEntry = await prisma.moderationQueue.findFirst({
        where: {
          entityType: "POST",
          entityId: postId,
          decision: { in: ["BLOCK", "DELETE"] },
        },
      });
      if (modQueueEntry) {
        await this.writeCache(postId, 0.0, { moderationBlocked: true });
        return 0.0;
      }

      // Check resolved reports that resulted in deletion
      const reports = await prisma.report.findMany({
        where: {
          contentType: "POST",
          contentId: postId,
          status: "RESOLVED",
        },
      });
      if (reports.length > 0) {
        await this.writeCache(postId, 0.0, { reportResolved: true });
        return 0.0;
      }

      // 3. Compute creator trust factor
      let creatorMultiplier = 1.0;
      const trust = post.user.creatorTrust;
      const violationCount = post.user.violations.length;

      if (trust) {
        // trustScore is in [0, 1]
        creatorMultiplier = trust.trustScore;
      }
      // Deduct for active violations
      if (violationCount > 0) {
        creatorMultiplier = Math.max(0.1, creatorMultiplier - violationCount * 0.15);
      }

      // 4. Content Integrity (Check duplicates by author)
      let integrityMultiplier = 1.0;
      const spamFlags: Record<string, boolean> = {};

      if (post.content && post.content.trim().length > 10) {
        // Query recent posts by same author in last 24h
        const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const similarPosts = await prisma.post.findMany({
          where: {
            userId: post.userId,
            id: { not: postId },
            createdAt: { gte: recentCutoff },
            content: post.content,
          },
        });
        if (similarPosts.length > 0) {
          integrityMultiplier *= 0.5; // Halve the score for duplicates
          spamFlags.duplicateContent = true;
        }
      }

      // 5. Engagement authenticity spike checking
      // If likes or shares grew unnaturally relative to views (e.g. likes > views, when views > 5)
      const likesCount = await prisma.reaction.count({ where: { postId } });
      const viewsCount = post.viewCount || 0;
      let authenticityMultiplier = 1.0;

      if (viewsCount > 5 && likesCount > viewsCount * 1.5) {
        authenticityMultiplier *= 0.5; // Penalise for suspected bot likes
        spamFlags.engagementAuthenticitySpike = true;
      }

      // 6. Combine all scores to final multiplier
      const finalMultiplier = Math.max(
        0.0,
        Math.min(1.0, creatorMultiplier * integrityMultiplier * authenticityMultiplier)
      );

      await this.writeCache(postId, finalMultiplier, spamFlags);
      return finalMultiplier;
    } catch (error) {
      console.error("Error recomputing post quality:", error);
      return 1.0;
    }
  }

  /**
   * Helper to update database PostQualityCache.
   */
  private static async writeCache(
    postId: string,
    multiplier: number,
    spamFlags: Record<string, boolean>
  ) {
    try {
      await prisma.postQualityCache.upsert({
        where: { postId },
        update: {
          qualityScore: multiplier,
          spamFlags: JSON.stringify(spamFlags),
          updatedAt: new Date(),
        },
        create: {
          postId,
          qualityScore: multiplier,
          spamFlags: JSON.stringify(spamFlags),
        },
      });
    } catch (e) {
      console.error("Failed to write quality cache key:", e);
    }
  }
}
