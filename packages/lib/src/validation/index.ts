import { z } from "zod";

// Auth Schemas
export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  phone: z.string().min(8, "Phone number must be at least 8 characters").optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(2, "Name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters").max(30).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  code: z.string().length(6).optional().or(z.literal("")), // optional 2FA code
});

export const profileUpdateSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters"),
  bio: z.string().max(200, "Bio must be at most 200 characters").optional(),
  websiteUrl: z.string().url("Invalid website URL").optional().or(z.literal("")),
  location: z.string().optional(),
  privacyLevel: z.enum(["PUBLIC", "FRIENDS", "PRIVATE"]),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  coverUrl: z.string().url().optional().or(z.literal("")),
});

// Post & Interaction Schemas
export const postCreateSchema = z.object({
  content: z.string().max(2000, "Post is too long").optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  type: z.enum(["TEXT", "IMAGE", "CAROUSEL", "VIDEO", "REEL"]),
  visibility: z.enum(["PUBLIC", "FRIENDS", "PRIVATE"]),
  groupId: z.string().optional().nullable(),
  pageId: z.string().optional().nullable(),
  pollQuestion: z.string().max(200).optional(),
  pollOptions: z.array(z.string().min(1)).max(10).optional(),
});

export const commentCreateSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(1000),
  postId: z.string().optional(),
  reelId: z.string().optional(),
  parentId: z.string().optional(),
});

// Chat Schemas
export const messageCreateSchema = z.object({
  conversationId: z.string(),
  content: z.string().min(1, "Message cannot be empty").optional(),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(["IMAGE", "VIDEO", "FILE"]).optional(),
});
