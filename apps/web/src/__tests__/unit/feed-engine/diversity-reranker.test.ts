import { describe, it, expect } from "vitest";
import { DiversityReranker } from "@/server/services/feed-engine/diversity-reranker";

describe("DiversityReranker", () => {
  it("filters out posts with zero qualityMultiplier", () => {
    const candidates = [
      { post: { id: "p1", userId: "u1", _qualityMultiplier: 0.8 }, sources: ["following"], finalScore: 0.9 },
      { post: { id: "p2", userId: "u2", _qualityMultiplier: 0.0 }, sources: ["following"], finalScore: 0.8 },
      { post: { id: "p3", userId: "u3" }, sources: ["following"], finalScore: 0.7 }, // defaults to 1.0
    ];

    const res = DiversityReranker.rerank(candidates, 5, { qualityFloor: 0.0 });
    expect(res).toHaveLength(2);
    expect(res.map((p: any) => p.id)).not.toContain("p2");
  });

  it("prevents consecutive posts by the same author", () => {
    const candidates = [
      { post: { id: "p1", userId: "author-a" }, sources: ["following"], finalScore: 0.9 },
      { post: { id: "p2", userId: "author-a" }, sources: ["following"], finalScore: 0.85 },
      { post: { id: "p3", userId: "author-b" }, sources: ["following"], finalScore: 0.8 },
      { post: { id: "p4", userId: "author-a" }, sources: ["following"], finalScore: 0.75 },
    ];

    const res = DiversityReranker.rerank(candidates, 4, { maxPerAuthor: 5 });
    // First element should be p1. Second element should be p3 (author-b) because p2 is author-a which matches p1.
    expect(res[0].id).toBe("p1");
    expect(res[1].id).toBe("p3");
    expect(res[2].id).toBe("p2");
    expect(res[3].id).toBe("p4");
  });

  it("strictly caps max posts per author per page", () => {
    const candidates = [
      { post: { id: "p1", userId: "author-a" }, sources: ["following"], finalScore: 0.9 },
      { post: { id: "p2", userId: "author-a" }, sources: ["following"], finalScore: 0.85 },
      { post: { id: "p3", userId: "author-a" }, sources: ["following"], finalScore: 0.85 },
      { post: { id: "p4", userId: "author-b" }, sources: ["following"], finalScore: 0.75 },
    ];

    const res = DiversityReranker.rerank(candidates, 4, { maxPerAuthor: 2 });
    // Should contain p1, p2, p4, but NOT p3 because author-a limit is reached
    const ids = res.map((p: any) => p.id);
    expect(ids).toContain("p1");
    expect(ids).toContain("p2");
    expect(ids).toContain("p4");
    expect(ids).not.toContain("p3");
  });

  it("guarantees trending slots at specified frequency", () => {
    const candidates = [
      { post: { id: "p1", userId: "u1" }, sources: ["following"], finalScore: 0.9 },
      { post: { id: "p2", userId: "u2" }, sources: ["following"], finalScore: 0.8 },
      { post: { id: "p3", userId: "u3" }, sources: ["trending"], finalScore: 0.75 },
      { post: { id: "p4", userId: "u4" }, sources: ["following"], finalScore: 0.7 },
    ];

    // Force trending slot every 2 items
    const res = DiversityReranker.rerank(candidates, 4, {
      trendingGuaranteedEvery: 2,
      maxPerAuthor: 5
    });
    // Position 0 = normal (p1)
    // Position 1 = normal (p2)
    // Position 2 = must be trending slot matching p3
    expect(res[2].id).toBe("p3");
  });
});
