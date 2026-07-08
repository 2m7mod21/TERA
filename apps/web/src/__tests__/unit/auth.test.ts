import { describe, it, expect, vi } from "vitest";
import { registerUser } from "../../src/server/actions/auth.js";

// Mock the Prisma module
vi.mock("db", () => {
  return {
    prisma: {
      user: {
        findFirst: vi.fn().mockImplementation(async ({ where }) => {
          if (where.email === "existing@tera.social") {
            return { id: "1", email: "existing@tera.social" };
          }
          return null;
        }),
        create: vi.fn().mockResolvedValue({ id: "new-user-123" }),
      },
    },
  };
});

describe("Authentication Server Actions", () => {
  it("should fail validation with invalid input data", async () => {
    const invalidForm = {
      email: "not-an-email",
      password: "123", // too short
      displayName: "",
      username: "t",
    };

    const res = await registerUser(invalidForm);
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });

  it("should block registration if email already exists", async () => {
    const doubleForm = {
      email: "existing@tera.social",
      password: "password123",
      displayName: "Jane Test",
      username: "janetest",
    };

    const res = await registerUser(doubleForm);
    expect(res.success).toBe(false);
    expect(res.error?.global).toContain("already in use");
  });
});
