import { prisma } from "@/lib/db";

export class FatigueScorer {
  /**
   * Returns fatigueMultiplier ∈ [0, 1] for a viewer/author pair.
   * Escalates penalty as the viewer is shown more posts from the same author
   * without engaging. Resets if the viewer engages (shownCount >> ignoredCount).
   *
   * @param maxPerWindow – hard cap: multiplier = 0 if shown ≥ maxPerWindow
   */
  static async getFatigueMultiplier(
    viewerId: string,
    authorId: string,
    maxPerWindow = 5
  ): Promise<number> {
    try {
      const db = prisma as any;

      const fatigue = await db.exposureFatigue.findUnique({
        where: {
          userId_targetType_targetId: {
            userId: viewerId,
            targetType: "AUTHOR",
            targetId: authorId,
          },
        },
      });

      if (!fatigue) return 1.0;

      const { shownCount, engagedCount } = fatigue;

      // Hard cap
      if (shownCount >= maxPerWindow) return 0.0;

      // If user has engaged with most shown posts, no fatigue penalty
      if (engagedCount >= shownCount * 0.6) return 1.0;

      // Gradual linear decay based on ignored ratio
      const ignoredRatio = (shownCount - engagedCount) / Math.max(1, shownCount);
      const multiplier = Math.max(0.0, 1.0 - ignoredRatio * 0.8);

      return multiplier;
    } catch (error) {
      console.error("Error computing fatigue score:", error);
      return 1.0;
    }
  }
}
