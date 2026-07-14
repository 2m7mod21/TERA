import { describe, it, expect, vi, beforeEach } from "vitest";
import { FatigueScorer } from "@/server/services/feed-engine/fatigue-scorer";

vi.mock("@/lib/db", () => ({
  prisma: {
    exposureFatigue: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";

describe("FatigueScorer", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 1.0 when no fatigue record exists", async () => {
    (prisma as any).exposureFatigue.findUnique = vi.fn().mockResolvedValue(null);
    const m = await FatigueScorer.getFatigueMultiplier("viewer", "author");
    expect(m).toBe(1.0);
  });

  it("returns 0.0 when viewer has seen post at/above maxPerWindow", async () => {
    (prisma as any).exposureFatigue.findUnique = vi.fn().mockResolvedValue({
      shownCount: 10, ignoredCount: 5
    });
    const m = await FatigueScorer.getFatigueMultiplier("viewer", "author", 5);
    expect(m).toBe(0.0);
  });

  it("returns 1.0 when viewer engaged with most shown posts", async () => {
    (prisma as any).exposureFatigue.findUnique = vi.fn().mockResolvedValue({
      shownCount: 4, ignoredCount: 0, // all engaged
    });
    const m = await FatigueScorer.getFatigueMultiplier("viewer", "author", 10);
    expect(m).toBe(1.0);
  });

  it("returns reduced score when many posts ignored", async () => {
    (prisma as any).exposureFatigue.findUnique = vi.fn().mockResolvedValue({
      shownCount: 4, ignoredCount: 4, // all ignored
    });
    const m = await FatigueScorer.getFatigueMultiplier("viewer", "author", 10);
    expect(m).toBeLessThan(0.5);
  });

  it("returns 1.0 on DB error (safe fallback)", async () => {
    (prisma as any).exposureFatigue.findUnique = vi.fn().mockRejectedValue(new Error("DB fail"));
    const m = await FatigueScorer.getFatigueMultiplier("viewer", "author");
    expect(m).toBe(1.0);
  });
});
