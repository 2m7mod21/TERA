import { describe, it, expect } from "vitest";
import { EngagementScorer } from "@/server/services/feed-engine/engagement-scorer";

describe("EngagementScorer.getEngagementScore", () => {
  it("returns 0 for post with no engagement", () => {
    const score = EngagementScorer.getEngagementScore({
      likeCount: 0, commentCount: 0, shareCount: 0, viewCount: 0,
    });
    expect(score).toBe(0.0);
  });

  it("returns higher score when comments dominate (higher weight)", () => {
    const commentHeavy = EngagementScorer.getEngagementScore({
      likeCount: 0, commentCount: 10, shareCount: 0, viewCount: 10,
    });
    const likeHeavy = EngagementScorer.getEngagementScore({
      likeCount: 10, commentCount: 0, shareCount: 0, viewCount: 10,
    });
    expect(commentHeavy).toBeGreaterThan(likeHeavy);
  });

  it("shares score higher than comments, which is higher than likes (by default weights)", () => {
    const shareScore = EngagementScorer.getEngagementScore({ likeCount: 0, commentCount: 0, shareCount: 1, viewCount: 10 });
    const commentScore = EngagementScorer.getEngagementScore({ likeCount: 0, commentCount: 1, shareCount: 0, viewCount: 10 });
    const likeScore = EngagementScorer.getEngagementScore({ likeCount: 1, commentCount: 0, shareCount: 0, viewCount: 10 });
    expect(shareScore).toBeGreaterThan(commentScore);
    expect(commentScore).toBeGreaterThan(likeScore);
  });

  it("returns value in [0, 1]", () => {
    const score = EngagementScorer.getEngagementScore({
      likeCount: 10000, commentCount: 10000, shareCount: 10000, viewCount: 1,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("penalises high-like/low-view posts via normalisation (not via score clamp)", () => {
    const normal = EngagementScorer.getEngagementScore({ likeCount: 5, commentCount: 2, shareCount: 1, viewCount: 100 });
    const weirdSpike = EngagementScorer.getEngagementScore({ likeCount: 1000, commentCount: 0, shareCount: 0, viewCount: 1 });
    // Due to normalisation, even huge raw scores get mapped to < 1
    expect(weirdSpike).toBeLessThan(1.0);
    expect(normal).toBeGreaterThan(0);
  });
});
