import { prisma } from "@/lib/db";

export class SuppressionScorer {
  /**
   * Returns suppressionMultiplier ∈ [0, 1] for a viewer/post pair.
   * Hard 0 if viewer has explicitly hidden or reported this post.
   * Soft decay if viewer hidden/reported the same author.
   */
  static async getSuppressionMultiplier(
    viewerId: string,
    postId: string,
    authorId: string
  ): Promise<number> {
    try {
      const db = prisma as any;

      // 1. Hard post-level suppression
      const postSuppression = await db.feedSuppressionEntry.findFirst({
        where: {
          userId: viewerId,
          targetType: "POST",
          targetId: postId,
        },
      });
      if (postSuppression) return 0.0;

      // 2. Soft author-level suppression
      const authorSuppression = await db.feedSuppressionEntry.findFirst({
        where: {
          userId: viewerId,
          targetType: "AUTHOR",
          targetId: authorId,
        },
      });
      if (!authorSuppression) return 1.0;

      // Author-level: decay based on strength and time elapsed
      const base = Math.max(0.0, 1.0 - (authorSuppression.strength ?? 1.0));

      // Recover over 30 days using exponential decay
      const ageDays =
        (Date.now() - new Date(authorSuppression.createdAt).getTime()) /
        (1000 * 60 * 60 * 24);
      const decayFactor = 1 - Math.pow(0.5, ageDays / 30);

      const multiplier = Math.min(1.0, base + (1.0 - base) * decayFactor);

      return Math.max(0.0, multiplier);
    } catch (error) {
      console.error("Error computing suppression score:", error);
      return 1.0;
    }
  }

  /**
   * Record a suppression event (hide, see-fewer, report, unfollow).
   */
  static async addSuppression(
    viewerId: string,
    targetType: "POST" | "AUTHOR" | "TOPIC",
    targetId: string,
    strength = 1.0
  ) {
    try {
      const db = prisma as any;
      await db.feedSuppressionEntry.upsert({
        where: {
          userId_targetType_targetId: { userId: viewerId, targetType, targetId },
        },
        update: { strength, updatedAt: new Date() },
        create: { userId: viewerId, targetType, targetId, strength },
      });
    } catch (error) {
      console.error("Error adding suppression entry:", error);
    }
  }
}
