import { prisma } from "@/lib/db";

export type InteractionType = "LIKE" | "COMMENT" | "SHARE" | "HIDE" | "REPORT" | "VIEW" | "FOLLOW" | "UNFOLLOW";

export class InteractionLogger {
  /**
   * Log an interaction event to the database.
   * Also asynchronously updates affinity scores.
   */
  static async log({
    userId,
    type,
    targetType,
    targetId,
    weight = 1.0,
  }: {
    userId: string;
    type: InteractionType;
    targetType: "POST" | "COMMENT" | "STORY" | "REEL" | "USER";
    targetId: string;
    weight?: number;
  }) {
    try {
      // 1. Create the interaction event
      const event = await prisma.interactionEvent.create({
        data: {
          userId,
          type,
          targetType,
          targetId,
          weight,
        },
      });

      // 2. Trigger affinity update for this target
      // If the target is a post, comment, reel, or story, we want to update the affinity with its author.
      let authorId: string | null = null;
      if (targetType === "USER") {
        authorId = targetId;
      } else if (targetType === "POST") {
        const post = await prisma.post.findUnique({
          where: { id: targetId },
          select: { userId: true },
        });
        if (post) authorId = post.userId;
      } else if (targetType === "COMMENT") {
        const comment = await prisma.comment.findUnique({
          where: { id: targetId },
          select: { userId: true },
        });
        if (comment) authorId = comment.userId;
      } else if (targetType === "STORY") {
        const story = await prisma.story.findUnique({
          where: { id: targetId },
          select: { userId: true },
        });
        if (story) authorId = story.userId;
      } else if (targetType === "REEL") {
        const reel = await prisma.reel.findUnique({
          where: { id: targetId },
          select: { userId: true },
        });
        if (reel) authorId = reel.userId;
      }

      if (authorId && authorId !== userId) {
        // Run affinity check increment in background
        await this.adjustAffinity(userId, authorId, type);
      }

      // 3. If type is HIDE or REPORT immediately create suppression entry
      if (type === "HIDE" || type === "REPORT") {
        await prisma.feedSuppressionEntry.upsert({
          where: {
            userId_targetType_targetId: {
              userId,
              targetType: targetType === "USER" ? "AUTHOR" : "POST",
              targetId,
            },
          },
          update: {
            strength: 1.0,
            updatedAt: new Date(),
          },
          create: {
            userId,
            targetType: targetType === "USER" ? "AUTHOR" : "POST",
            targetId,
            strength: 1.0,
          },
        });

        // Also suppress author if post is reported/hidden
        if (authorId && authorId !== userId) {
          await prisma.feedSuppressionEntry.upsert({
            where: {
              userId_targetType_targetId: {
                userId,
                targetType: "AUTHOR",
                targetId: authorId,
              },
            },
            update: {
              strength: type === "REPORT" ? 1.0 : 0.5,
              updatedAt: new Date(),
            },
            create: {
              userId,
              targetType: "AUTHOR",
              targetId: authorId,
              strength: type === "REPORT" ? 1.0 : 0.5,
            },
          });
        }
      }

      return event;
    } catch (error) {
      console.error("Failed to log interaction event:", error);
      return null;
    }
  }

  /**
   * Adjust affinity score value incrementally.
   */
  private static async adjustAffinity(userId: string, authorId: string, type: InteractionType) {
    let delta = 0.0;
    switch (type) {
      case "LIKE":
        delta = 2.0;
        break;
      case "COMMENT":
        delta = 5.0;
        break;
      case "SHARE":
        delta = 8.0;
        break;
      case "VIEW":
        delta = 0.1;
        break;
      case "FOLLOW":
        delta = 10.0;
        break;
      case "UNFOLLOW":
        delta = -10.0;
        break;
      case "HIDE":
        delta = -5.0;
        break;
      case "REPORT":
        delta = -15.0;
        break;
    }

    if (delta === 0.0) return;

    try {
      const existing = await prisma.affinityScore.findUnique({
        where: {
          userId_targetType_targetId: {
            userId,
            targetType: "USER",
            targetId: authorId,
          },
        },
      });

      const newScore = Math.max(0.0, (existing?.score ?? 0.0) + delta);

      await prisma.affinityScore.upsert({
        where: {
          userId_targetType_targetId: {
            userId,
            targetType: "USER",
            targetId: authorId,
          },
        },
        update: {
          score: newScore,
        },
        create: {
          userId,
          targetType: "USER",
          targetId: authorId,
          score: newScore,
        },
      });
    } catch (error) {
      console.error("Failed to adjust affinity:", error);
    }
  }
}
