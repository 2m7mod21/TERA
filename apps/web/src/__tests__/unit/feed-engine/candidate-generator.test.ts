import { describe, it, expect, vi, beforeEach } from "vitest";
import { CandidateGenerator } from "@/server/services/candidate-generator.service";

vi.mock("@/lib/db", () => ({
  prisma: {
    follow: { findMany: vi.fn() },
    post: { findMany: vi.fn() },
    reaction: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";

describe("CandidateGenerator", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("getFollowingCandidates query correctly", async () => {
    (prisma as any).follow.findMany = vi.fn().mockResolvedValue([{ followeeId: "user-b" }]);
    (prisma as any).post.findMany = vi.fn().mockResolvedValue([{ id: "post-1", userId: "user-b" }]);

    const res = await CandidateGenerator.getFollowingCandidates("user-a");
    expect(res).toHaveLength(1);
    expect(res[0]!.sources).toContain("following");
  });

  it("mergeCandidates deduplicates posts and unions sources", () => {
    const pool1 = [{ post: { id: "post-1", content: "foo" }, sources: ["following"] }];
    const pool2 = [
      { post: { id: "post-1", content: "foo" }, sources: ["trending"] },
      { post: { id: "post-2", content: "bar" }, sources: ["cold-start"] },
    ];

    const merged = CandidateGenerator.mergeCandidates([pool1, pool2]);
    expect(merged).toHaveLength(2);

    const post1 = merged.find((m: any) => m.post.id === "post-1");
    const post2 = merged.find((m: any) => m.post.id === "post-2");

    expect(post1?.sources).toContain("following");
    expect(post1?.sources).toContain("trending");
    expect(post2?.sources).toContain("cold-start");
  });
});
