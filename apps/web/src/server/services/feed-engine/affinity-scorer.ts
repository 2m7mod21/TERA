import { prisma } from "@/lib/db";

export class AffinityScorer {
  /**
   * Get the normalised viewer -> author affinity score [0, 1].
   * Applies exponential time decay based on the last update timestamp.
   * Uses sigmoid-like function: score / (score + alpha) to scale [0, inf) to [0, 1).
   */
  static async getAffinityScore(
    viewerId: string,
    authorId: string,
    halfLifeDays = 7.0,
    alpha = 10.0
  ): Promise<number> {
    if (viewerId === authorId) return 1.0; // Self-posts get max affinity

    try {
      const record = await prisma.affinityScore.findUnique({
        where: {
          userId_targetType_targetId: {
            userId: viewerId,
            targetType: "USER",
            targetId: authorId,
          },
        },
      });

      if (!record) return 0.0;

      // 1. Calculate time decay
      const now = new Date();
      const diffMs = now.getTime() - record.updatedAt.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      // Decayed score = score * 0.5^(days / halfLife)
      const decayFactor = Math.pow(0.5, diffDays / halfLifeDays);
      const decayedScore = record.score * decayFactor;

      // 2. Normalisation using score / (score + alpha)
      const normalised = decayedScore / (decayedScore + alpha);
      
      return Math.max(0.0, Math.min(1.0, normalised));
    } catch (error) {
      console.error("Error fetching affinity score:", error);
      return 0.0;
    }
  }
}
