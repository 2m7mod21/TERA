import { prisma } from "@/lib/db";

export interface EngagementMetrics {
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
}

export class EngagementScorer {
  /**
   * Calculates post engagement rate proxy ∈ [0, 1] using global and local metrics.
   * engagement = (likes*wLike + comments*wComment + shares*wShare) / (views + eta)
   * normalises engagement to [0,1].
   */
  static getEngagementScore(
    metrics: EngagementMetrics,
    weights = { like: 1.0, comment: 3.0, share: 5.0 },
    eta = 10.0
  ): number {
    const { likeCount, commentCount, shareCount, viewCount } = metrics;

    // Calculate raw weighted score
    const numerator =
      likeCount * weights.like +
      commentCount * weights.comment +
      shareCount * weights.share;

    const denominator = viewCount + eta;
    const rawScore = numerator / denominator;

    // normalise rawScore ∈ [0, 1] using x / (x + 1)
    const normalised = rawScore / (rawScore + 1.0);

    return Math.max(0.0, Math.min(1.0, normalised));
  }

  /**
   * Writes the calculated scores for selected feed items to the FeedImpression log.
   * This is done bulk asynchronous to prevent blocking the request cycle.
   */
  static async logImpressions(
    viewerId: string,
    itemsToLog: Array<{
      postId: string;
      finalScore: number;
      components: {
        affinity: number;
        engagement: number;
        contentMatch: number;
        quality: number;
        suppression: number;
        fatigue: number;
      };
      source: string;
      position: number;
    }>
  ) {
    if (itemsToLog.length === 0) return;

    try {
      const data = itemsToLog.map((item) => ({
        userId: viewerId,
        postId: item.postId,
        score: item.finalScore,
        scoreBreakdown: JSON.stringify(item.components),
        source: item.source,
        position: item.position,
      }));

      await prisma.feedImpression.createMany({
        data,
      });

      // Increment exposure fatigue count for these authors
      // Fetch authors for the posts first
      const posts = await prisma.post.findMany({
        where: { id: { in: itemsToLog.map((i) => i.postId) } },
        select: { id: true, userId: true },
      });

      const fatigueUpserts = posts.map(async (p) => {
        const key = {
          userId_targetType_targetId: {
            userId: viewerId,
            targetType: "AUTHOR",
            targetId: p.userId,
          },
        };
        const existing = await prisma.exposureFatigue.findUnique({
          where: key,
        });

        if (existing) {
          await prisma.exposureFatigue.update({
            where: key,
            data: {
              shownCount: { increment: 1 },
              updatedAt: new Date(),
            },
          });
        } else {
          await prisma.exposureFatigue.create({
            data: {
              userId: viewerId,
              targetType: "AUTHOR",
              targetId: p.userId,
              shownCount: 1,
              engagedCount: 0,
            },
          });
        }
      });

      await Promise.all(fatigueUpserts);
    } catch (error) {
      console.error("Error logging feed impressions / updating fatigue:", error);
    }
  }
}
