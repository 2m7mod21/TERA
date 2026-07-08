import { prisma } from "@/lib/db";

export class AnalyticsService {
  /**
   * Tracks user interaction events in the analytics ledger
   */
  static async trackEvent(params: {
    userId: string;
    type: string;
    entityId?: string;
    entityType?: string;
    meta?: Record<string, any>;
  }) {
    const { userId, type, entityId, entityType, meta } = params;

    try {
      return prisma.analyticsEvent.create({
        data: {
          userId,
          type,
          entityId: entityId || null,
          entityType: entityType || null,
          meta: meta ? JSON.stringify(meta) : "{}",
        },
      });
    } catch (error) {
      console.error("trackEvent error:", error);
      return null;
    }
  }

  /**
   * Compiles activity summaries for dashboards
   */
  static async getSummaryStats() {
    try {
      const start = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h
      const [signups, posts, interactions] = await Promise.all([
        prisma.user.count({ where: { createdAt: { gte: start } } }),
        prisma.post.count({ where: { createdAt: { gte: start } } }),
        prisma.analyticsEvent.count({ where: { createdAt: { gte: start } } }),
      ]);

      return {
        dailySignups: signups,
        dailyPosts: posts,
        dailyInteractions: interactions,
      };
    } catch {
      return { dailySignups: 0, dailyPosts: 0, dailyInteractions: 0 };
    }
  }
}
