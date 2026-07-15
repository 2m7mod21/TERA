import { prisma } from "@/lib/db";
import { CandidateGenerator, CandidateWrapper } from "@/server/services/candidate-generator.service";
import { AffinityScorer } from "./affinity-scorer";
import { TopicMatcher } from "./topic-matcher";
import { EngagementScorer } from "./engagement-scorer";
import { QualityScorer } from "./quality-scorer";
import { SuppressionScorer } from "./suppression-scorer";
import { FatigueScorer } from "./fatigue-scorer";

export interface FeedWeights {
  affinity: number;
  engagement: number;
  contentMatch: number;
  recency: number;
  coldStart: number;
  quality: number;
  halfLifeHours: number;
  maxPerAuthor: number;
  explorationSlotPct: number;
  trendingGuaranteedEvery: number;
  coldStartGuaranteedEvery: number;
}

const DEFAULT_WEIGHTS: FeedWeights = {
  affinity: 0.30,
  engagement: 0.25,
  contentMatch: 0.20,
  recency: 0.15,
  coldStart: 0.10,
  quality: 1.0,
  halfLifeHours: 48,
  maxPerAuthor: 2,
  explorationSlotPct: 0.10,
  trendingGuaranteedEvery: 8,
  coldStartGuaranteedEvery: 10,
};

export interface SessionContext {
  deviceType?: "mobile" | "desktop";
  sessionDurationSec?: number;
}

export class FeedEngine {

  static async loadWeights(profileName = "default"): Promise<FeedWeights> {
    try {
      const db = prisma as any;
      const configs = await db.feedWeightConfig.findMany({
        where: { profileName },
        select: { componentKey: true, weightValue: true },
      });

      if (!configs || configs.length === 0) return DEFAULT_WEIGHTS;

      const overrides: Partial<FeedWeights> = {};
      for (const c of configs) {
        (overrides as any)[c.componentKey] = c.weightValue;
      }
      return { ...DEFAULT_WEIGHTS, ...overrides };
    } catch {
      return DEFAULT_WEIGHTS;
    }
  }

  /**
   * Two-stage feed generation:
   * 1. Candidate generation (5 sources, merged + deduped)
   * 2. Per-candidate scoring using all 6 components
   */
  static async getRankedFeed(
    viewerId: string,
    limit = 12,
    _sessionContext?: SessionContext
  ): Promise<any[]> {
    const weights = await this.loadWeights();

    // Stage 1: Generate candidates from all sources in parallel
    const [following, contentMatch, collaborative, trending, coldStart] = await Promise.all([
      CandidateGenerator.getFollowingCandidates(viewerId),
      CandidateGenerator.getContentMatchCandidates(viewerId),
      CandidateGenerator.getCollaborativeCandidates(viewerId),
      CandidateGenerator.getTrendingCandidates(viewerId),
      CandidateGenerator.getColdStartCandidates(viewerId),
    ]);

    const candidatePool = CandidateGenerator.mergeCandidates([
      following, contentMatch, collaborative, trending, coldStart,
    ]);

    if (candidatePool.length === 0) return [];

    // Stage 2: Score each candidate
    const now = Date.now();
    const halfLifeMs = weights.halfLifeHours * 3_600_000;

    const scoredCandidates = await Promise.all(
      candidatePool.map(async (wrapper: CandidateWrapper) => {
        const { post, sources } = wrapper;
        const authorId: string = post.userId;

        const [
          affinityScore,
          topicMatchScore,
          suppressionMultiplier,
          fatigueMultiplier,
          qualityMultiplier,
        ] = await Promise.all([
          AffinityScorer.getAffinityScore(viewerId, authorId),
          TopicMatcher.getTopicMatchScore(viewerId, post.hashtags ?? []),
          SuppressionScorer.getSuppressionMultiplier(viewerId, post.id, authorId),
          FatigueScorer.getFatigueMultiplier(viewerId, authorId, weights.maxPerAuthor * 2),
          QualityScorer.getQualityScore(post.id),
        ]);

        // Hard exclusion – quality multiplier = 0 means blocked/spam
        if (qualityMultiplier === 0) {
          return null;
        }

        // Recency score using configurable half-life
        const ageMs = now - new Date(post.createdAt).getTime();
        const recencyScore = Math.pow(0.5, ageMs / halfLifeMs);

        // Engagement score from post metrics
        const engagementScore = EngagementScorer.getEngagementScore({
          likeCount: post.reactions?.length ?? post._count?.reactions ?? 0,
          commentCount: post._count?.comments ?? 0,
          shareCount: post.shareCount ?? 0,
          viewCount: post.viewCount ?? 0,
        });

        // Cold-start boost if this candidate came from cold-start source
        const coldStartBoost = sources.includes("cold-start") ? 1.0 : 0.0;

        // Final score formula (Section 3.11)
        const baseScore =
          affinityScore * weights.affinity +
          engagementScore * weights.engagement +
          topicMatchScore * weights.contentMatch +
          recencyScore * weights.recency +
          coldStartBoost * weights.coldStart;

        const finalScore =
          baseScore *
          qualityMultiplier *
          suppressionMultiplier *
          fatigueMultiplier;

        return {
          post,
          sources,
          finalScore,
          components: {
            affinity: affinityScore,
            engagement: engagementScore,
            contentMatch: topicMatchScore,
            recency: recencyScore,
            quality: qualityMultiplier,
            suppression: suppressionMultiplier,
            fatigue: fatigueMultiplier,
            coldStart: coldStartBoost,
          },
        };
      })
    );

    // Filter out null (excluded) candidates
    const validCandidates = scoredCandidates.filter(
      (c): c is NonNullable<typeof c> => c !== null
    );

    // Sort by score descending
    validCandidates.sort((a, b) => b.finalScore - a.finalScore);

    // Fire-and-forget impression logging
    void EngagementScorer.logImpressions(
      viewerId,
      validCandidates.slice(0, limit).map((c, index) => ({
        postId: c.post.id,
        finalScore: c.finalScore,
        components: {
          affinity: c.components.affinity,
          engagement: c.components.engagement,
          contentMatch: c.components.contentMatch,
          quality: c.components.quality,
          suppression: c.components.suppression,
          fatigue: c.components.fatigue,
        },
        source: (c.sources[0] || "exploration").toUpperCase().replace("-", "_"),
        position: index,
      }))
    );

    return validCandidates.slice(0, limit).map((c) => c.post);
  }
}
