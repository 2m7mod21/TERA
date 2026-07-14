import { describe, it, expect, vi, beforeEach } from "vitest";
import { TopicMatcher } from "@/server/services/feed-engine/topic-matcher";

vi.mock("@/lib/db", () => ({
  prisma: {
    topicAffinity: { findMany: vi.fn() },
    profile: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";

describe("TopicMatcher", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 0 when post has no hashtags", async () => {
    const score = await TopicMatcher.getTopicMatchScore("viewer", []);
    expect(score).toBe(0.0);
  });

  it("returns 0 when viewer has no topic affinities", async () => {
    (prisma as any).topicAffinity.findMany = vi.fn().mockResolvedValue([]);
    (prisma as any).profile.findUnique = vi.fn().mockResolvedValue({ interests: null });
    const score = await TopicMatcher.getTopicMatchScore("viewer", [{ hashtag: { name: "coding" } }]);
    expect(score).toBe(0.0);
  });

  it("returns positive score when hashtag matches user topic affinity", async () => {
    (prisma as any).topicAffinity.findMany = vi.fn().mockResolvedValue([
      { topic: "coding", score: 20 },
    ]);
    (prisma as any).profile.findUnique = vi.fn().mockResolvedValue({ interests: null });

    const score = await TopicMatcher.getTopicMatchScore("viewer", [{ hashtag: { name: "coding" } }]);
    expect(score).toBeGreaterThan(0.5); // 20/(20+5) = 0.8
  });

  it("is case-insensitive when matching tags", async () => {
    (prisma as any).topicAffinity.findMany = vi.fn().mockResolvedValue([
      { topic: "CODING", score: 10 },
    ]);
    (prisma as any).profile.findUnique = vi.fn().mockResolvedValue({ interests: null });

    const score = await TopicMatcher.getTopicMatchScore("viewer", [{ hashtag: { name: "coding" } }]);
    expect(score).toBeGreaterThan(0);
  });

  it("uses profile interests as fallback topic source", async () => {
    (prisma as any).topicAffinity.findMany = vi.fn().mockResolvedValue([]);
    (prisma as any).profile.findUnique = vi.fn().mockResolvedValue({
      interests: JSON.stringify(["travel"]),
    });

    const score = await TopicMatcher.getTopicMatchScore("viewer", [{ hashtag: { name: "travel" } }]);
    expect(score).toBeGreaterThan(0);
  });

  it("returns value in [0, 1]", async () => {
    (prisma as any).topicAffinity.findMany = vi.fn().mockResolvedValue([
      { topic: "tech", score: 9999 },
    ]);
    (prisma as any).profile.findUnique = vi.fn().mockResolvedValue({ interests: null });

    const score = await TopicMatcher.getTopicMatchScore("viewer", [{ hashtag: { name: "tech" } }]);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
