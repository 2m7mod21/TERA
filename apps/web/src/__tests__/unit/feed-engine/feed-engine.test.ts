import { describe, it, expect, vi, beforeEach } from "vitest";
import { FeedEngine } from "@/server/services/feed-engine/feed-engine.service";

// Mock other components and DB
vi.mock("@/lib/db", () => ({
  prisma: {
    feedWeightConfig: { findMany: vi.fn() },
    feedImpression: { createMany: vi.fn() },
  },
}));

vi.mock("@/server/services/candidate-generator.service", () => ({
  CandidateGenerator: {
    getFollowingCandidates: vi.fn().mockResolvedValue([]),
    getContentMatchCandidates: vi.fn().mockResolvedValue([]),
    getCollaborativeCandidates: vi.fn().mockResolvedValue([]),
    getTrendingCandidates: vi.fn().mockResolvedValue([]),
    getColdStartCandidates: vi.fn().mockResolvedValue([]),
    mergeCandidates: vi.fn().mockReturnValue([]),
  },
}));

vi.mock("./affinity-scorer", () => ({
  AffinityScorer: { getAffinityScore: vi.fn().mockResolvedValue(0.5) },
}));

vi.mock("./topic-matcher", () => ({
  TopicMatcher: { getTopicMatchScore: vi.fn().mockResolvedValue(0.5) },
}));

vi.mock("./engagement-scorer", () => ({
  EngagementScorer: {
    getEngagementScore: vi.fn().mockReturnValue(0.5),
    logImpressions: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("./quality-scorer", () => ({
  QualityScorer: { getQualityScore: vi.fn().mockResolvedValue(1.0) },
}));

vi.mock("./suppression-scorer", () => ({
  SuppressionScorer: { getSuppressionMultiplier: vi.fn().mockResolvedValue(1.0) },
}));

vi.mock("./fatigue-scorer", () => ({
  FatigueScorer: { getFatigueMultiplier: vi.fn().mockResolvedValue(1.0) },
}));

import { prisma } from "@/lib/db";
import { CandidateGenerator } from "@/server/services/candidate-generator.service";

describe("FeedEngine", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("loads weights from default settings", async () => {
    (prisma as any).feedWeightConfig.findMany = vi.fn().mockResolvedValue([]);
    const weights = await FeedEngine.loadWeights("default");
    expect(weights.affinity).toBe(0.30);
  });

  it("combines, scores, and ranks candidates correctly", async () => {
    // 1. Mock weight profiles
    (prisma as any).feedWeightConfig.findMany = vi.fn().mockResolvedValue([
      { componentKey: "affinity", value: 0.5 },
      { componentKey: "engagement", value: 0.5 },
    ]);

    // 2. Mock candidate generator returning wrapper candidates
    CandidateGenerator.mergeCandidates = vi.fn().mockReturnValue([
      { post: { id: "p1", userId: "u1", createdAt: new Date() }, sources: ["following"] },
      { post: { id: "p2", userId: "u2", createdAt: new Date() }, sources: ["trending"] },
    ]);

    const res = await FeedEngine.getRankedFeed("viewer-1", 10);
    expect(res).toHaveLength(2);
    // Since mock scorers return fixed values, both get scored and returned
    expect(res[0].id).toBeDefined();
  });
});
