import { describe, it, expect, vi } from "vitest";
import { createPost } from "../../src/server/actions/posts.js";

vi.mock("db", () => ({
  prisma: {},
}));

vi.mock("@/server/auth/config", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "user-123" } }),
}));

vi.mock("@/server/repositories/post.repository", () => ({
  PostRepository: {
    createPost: vi.fn().mockResolvedValue({ id: "post-123", userId: "user-123" }),
  },
}));

describe("Post Interaction Actions", () => {
  it("should reject creation if form content exceeds size constraints", async () => {
    const oversizedForm = {
      content: "a".repeat(2001), // exceeds 2000 limit
      type: "TEXT",
      visibility: "PUBLIC",
    };

    const res = await createPost(oversizedForm);
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });

  it("should create post successfully with valid form parameters", async () => {
    const validForm = {
      content: "hello world!",
      type: "TEXT",
      visibility: "PUBLIC",
    };

    const res = await createPost(validForm);
    expect(res.success).toBe(true);
    expect(res.post).toBeDefined();
  });
});
