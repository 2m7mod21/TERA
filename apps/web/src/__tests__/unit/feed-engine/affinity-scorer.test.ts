import { describe, it, expect, vi, beforeEach } from "vitest";
import { AffinityScorer } from "@/server/services/feed-engine/affinity-scorer";

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    affinityScore: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";

describe("AffinityScorer", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 1.0 for self (viewerId === authorId)", async () => {
    const score = await AffinityScorer.getAffinityScore("user-1", "user-1");
    expect(score).toBe(1.0);
  });

  it("returns 0.0 when no record exists", async () => {
    (prisma as any).affinityScore.findUnique = vi.fn().mockResolvedValue(null);
    const score = await AffinityScorer.getAffinityScore("viewer", "author");
    expect(score).toBe(0.0);
  });

  it("applies time decay – fresh record returns high score", async () => {
    (prisma as any).affinityScore.findUnique = vi.fn().mockResolvedValue({
      score: 50,
      updatedAt: new Date(), // just now = no decay
    });
    const score = await AffinityScorer.getAffinityScore("viewer", "author");
    expect(score).toBeGreaterThan(0.7); // 50/(50+10) ≈ 0.83
  });

  it("applies time decay – stale record (30 days old) returns lower score", async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    (prisma as any).affinityScore.findUnique = vi.fn().mockResolvedValue({
      score: 50,
      updatedAt: thirtyDaysAgo, // 30 days ago, halfLife=7 → massive decay
    });
    const score = await AffinityScorer.getAffinityScore("viewer", "author");
    expect(score).toBeLessThan(0.25);
  });

  it("always returns value in [0, 1]", async () => {
    (prisma as any).affinityScore.findUnique = vi.fn().mockResolvedValue({
      score: 9999,
      updatedAt: new Date(),
    });
    const score = await AffinityScorer.getAffinityScore("viewer", "author");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("returns 0 on error", async () => {
    (prisma as any).affinityScore.findUnique = vi.fn().mockRejectedValue(new Error("DB error"));
    const score = await AffinityScorer.getAffinityScore("viewer", "author");
    expect(score).toBe(0.0);
  });
});
