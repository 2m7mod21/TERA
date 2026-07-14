import { describe, it, expect, vi, beforeEach } from "vitest";
import { QualityScorer } from "@/server/services/feed-engine/quality-scorer";

vi.mock("@/lib/db", () => ({
  prisma: {
    postQualityCache: { findUnique: vi.fn(), upsert: vi.fn() },
    post: { findUnique: vi.fn(), findMany: vi.fn() },
    creatorTrust: { findUnique: vi.fn() },
    report: { findMany: vi.fn() },
    moderationQueue: { findFirst: vi.fn() },
    reaction: { count: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";

describe("QualityScorer", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns cached quality score if valid and not expired", async () => {
    (prisma as any).postQualityCache.findUnique = vi.fn().mockResolvedValue({
      qualityScore: 0.85,
      updatedAt: new Date(), // fresh
    });
    const score = await QualityScorer.getQualityScore("post-1");
    expect(score).toBe(0.85);
  });

  it("recomputes score if cache is missing or expired", async () => {
    (prisma as any).postQualityCache.findUnique = vi.fn().mockResolvedValue(null);
    (prisma as any).post.findUnique = vi.fn().mockResolvedValue({
      id: "post-1",
      userId: "author-1",
      user: {
        isSuspended: false,
        isBanned: false,
        creatorTrust: null,
        violations: [],
      },
      content: "This is a clean post content here.",
    });
    (prisma as any).report.findMany = vi.fn().mockResolvedValue([]);
    (prisma as any).moderationQueue.findFirst = vi.fn().mockResolvedValue(null);
    (prisma as any).reaction.count = vi.fn().mockResolvedValue(0);
    (prisma as any).post.findMany = vi.fn().mockResolvedValue([]);
    (prisma as any).postQualityCache.upsert = vi.fn().mockResolvedValue({
      qualityScore: 1.0,
    });

    const score = await QualityScorer.getQualityScore("post-1");
    expect(score).toBeGreaterThanOrEqual(0.0);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it("excludes post (returns 0.0) if verified violation is present", async () => {
    (prisma as any).postQualityCache.findUnique = vi.fn().mockResolvedValue(null);
    (prisma as any).post.findUnique = vi.fn().mockResolvedValue({
      id: "post-1",
      userId: "author-1",
      user: {
        isSuspended: false,
        isBanned: false,
        creatorTrust: null,
        violations: [],
      },
      content: "Bad post content",
    });
    (prisma as any).report.findMany = vi.fn().mockResolvedValue([{ id: "rep-1" }]);
    (prisma as any).moderationQueue.findFirst = vi.fn().mockResolvedValue(null);
    (prisma as any).reaction.count = vi.fn().mockResolvedValue(0);
    (prisma as any).postQualityCache.upsert = vi.fn().mockResolvedValue({
      qualityScore: 0.0,
    });

    const score = await QualityScorer.getQualityScore("post-1");
    expect(score).toBe(0.0);
  });
});
