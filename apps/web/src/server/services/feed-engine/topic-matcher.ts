import { prisma } from "@/lib/db";

export interface PostHashtagWithDetails {
  hashtag: {
    name: string;
  };
}

export class TopicMatcher {
  /**
   * Calculates interest matching score ∈ [0, 1] between viewer interests and post hashtags.
   * Matches post hashtags against TopicAffinity scores and Profile interests JSON.
   */
  static async getTopicMatchScore(
    viewerId: string,
    postHashtags: PostHashtagWithDetails[],
    alpha = 5.0
  ): Promise<number> {
    if (postHashtags.length === 0) return 0.0;

    try {
      // 1. Fetch user topic affinities
      const userTopics = await prisma.topicAffinity.findMany({
        where: { userId: viewerId },
        select: { topic: true, score: true },
      });

      const topicMap = new Map<string, number>();
      for (const t of userTopics) {
        topicMap.set(t.topic.toLowerCase(), t.score);
      }

      // 2. Fetch profile interests
      const profile = await prisma.profile.findUnique({
        where: { userId: viewerId },
        select: { interests: true },
      });
      
      if (profile?.interests) {
        try {
          const parsed = JSON.parse(profile.interests);
          if (Array.isArray(parsed)) {
            for (const interest of parsed) {
              const clean = interest.toLowerCase();
              // Give profile interests a base weight of 2.0 if not already present
              if (!topicMap.has(clean)) {
                topicMap.set(clean, 2.0);
              }
            }
          }
        } catch {}
      }

      if (topicMap.size === 0) return 0.0;

      // 3. Compute overlap score (sum of matched affinity scores)
      let totalScore = 0.0;
      let matches = 0;

      for (const ph of postHashtags) {
        const tagName = ph.hashtag.name.toLowerCase();
        const score = topicMap.get(tagName);
        if (score !== undefined) {
          totalScore += score;
          matches++;
        }
      }

      if (matches === 0) return 0.0;

      // Normalize score to [0, 1] using x / (x + alpha)
      const normalised = totalScore / (totalScore + alpha);

      return Math.max(0.0, Math.min(1.0, normalised));
    } catch (error) {
      console.error("Error calculating topic match score:", error);
      return 0.0;
    }
  }
}
