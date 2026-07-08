import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { z } from "zod";

// ---- cn utility ----
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTimeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/&/g, "-and-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}

// ---- Zod Validation Schemas ----

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  phone: z
    .string()
    .min(8, "Phone number must be at least 8 characters")
    .optional()
    .or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(2, "Name must be at least 2 characters"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30)
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    ),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  code: z.string().length(6).optional().or(z.literal("")),
});

export const profileUpdateSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters"),
  bio: z.string().max(200, "Bio must be at most 200 characters").optional(),
  websiteUrl: z
    .string()
    .url("Invalid website URL")
    .optional()
    .or(z.literal("")),
  location: z.string().optional(),
  privacyLevel: z.enum(["PUBLIC", "FRIENDS", "PRIVATE"]),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  coverUrl: z.string().url().optional().or(z.literal("")),
});

export const postCreateSchema = z.object({
  content: z.string().max(2000, "Post is too long").optional(),
  mediaUrls: z.array(z.string()).optional(),
  type: z.enum(["TEXT", "IMAGE", "CAROUSEL", "VIDEO", "REEL", "POLL"]),
  visibility: z.enum(["PUBLIC", "FRIENDS", "PRIVATE"]),
  groupId: z.string().optional().nullable(),
  pageId: z.string().optional().nullable(),
  pollQuestion: z.string().max(200).optional(),
  pollOptions: z.array(z.string().min(1)).max(10).optional(),
  location: z.string().optional(),
  feeling: z.string().optional(),
});

export const commentCreateSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(1000),
  postId: z.string().optional(),
  reelId: z.string().optional(),
  parentId: z.string().optional(),
});

export const messageCreateSchema = z.object({
  conversationId: z.string(),
  content: z.string().min(1, "Message cannot be empty").optional(),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(["IMAGE", "VIDEO", "FILE"]).optional(),
});

// ---- Logger ----
export const logger = {
  info: (msg: string, data?: object) =>
    console.log(JSON.stringify({ level: "info", msg, ...data })),
  error: (msg: string, data?: object) =>
    console.error(JSON.stringify({ level: "error", msg, ...data })),
  warn: (msg: string, data?: object) =>
    console.warn(JSON.stringify({ level: "warn", msg, ...data })),
};

// ---- Local Storage Provider ----
import fs from "fs";
import path from "path";

export class LocalStorageProvider {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(
    buffer: Buffer,
    filename: string,
    _contentType: string
  ): Promise<string> {
    const ext = path.extname(filename);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const filePath = path.join(this.uploadDir, name);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/${name}`;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    const filename = path.basename(fileUrl);
    const filePath = path.join(this.uploadDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
