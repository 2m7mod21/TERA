import { describe, it, expect, vi, beforeEach } from "vitest";
import { SuppressionScorer } from "@/server/services/feed-engine/suppression-scorer";

vi.mock("@/lib/db", () => ({
  prisma: {
    feedSuppressionEntry: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";

describe("SuppressionScorer", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 1.0 when no suppression entry exists", async () => {
    (prisma as any).feedSuppressionEntry.findFirst = vi.fn().mockResolvedValue(null);
    const m = await SuppressionScorer.getSuppressionMultiplier("viewer", "post-1", "author-1");
    expect(m).toBe(1.0);
  });

  it("returns 0.0 when post is hard-hidden", async () => {
    (prisma as any).feedSuppressionEntry.findFirst = vi.fn()
      .mockResolvedValueOnce({ reason: "HIDE", createdAt: new Date() }) // post-level match
      .mockResolvedValue(null);
    const m = await SuppressionScorer.getSuppressionMultiplier("viewer", "post-1", "author-1");
    expect(m).toBe(0.0);
  });

  it("returns between 0 and 1 for author-level SEE_FEWER (fresh)", async () => {
    (prisma as any).feedSuppressionEntry.findFirst = vi.fn()
      .mockResolvedValueOnce(null) // no post-level
      .mockResolvedValueOnce({ reason: "SEE_FEWER", createdAt: new Date() }); // author-level
    const m = await SuppressionScorer.getSuppressionMultiplier("viewer", "post-1", "author-1");
    expect(m).toBeGreaterThanOrEqual(0.0);
    expect(m).toBeLessThan(1.0);
  });

  it("recovers over time for author-level suppression", async () => {
    const oldDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
    (prisma as any).feedSuppressionEntry.findFirst = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ reason: "SEE_FEWER", createdAt: oldDate });
    const m = await SuppressionScorer.getSuppressionMultiplier("viewer", "post-1", "author-1");
    // After 90 days, should have recovered significantly (from 0.25 base)
    expect(m).toBeGreaterThan(0.8);
  });

  it("returns 1.0 on DB error (safe fallback)", async () => {
    (prisma as any).feedSuppressionEntry.findFirst = vi.fn().mockRejectedValue(new Error("DB error"));
    const m = await SuppressionScorer.getSuppressionMultiplier("viewer", "post-1", "author-1");
    expect(m).toBe(1.0);
  });
});
