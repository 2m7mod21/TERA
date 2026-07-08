"use server";

import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

// ─── Get Active Stories ───────────────────────────────────────────────────────
export async function getStories() {
  const session = await auth();
  if (!session?.user?.id) return [];
  const myId = session.user.id;

  const following = await prisma.follow.findMany({
    where: { followerId: myId },
    select: { followeeId: true },
  });
  const userIds = [myId, ...following.map((f: { followeeId: string }) => f.followeeId)];

  const now = new Date();
  const rows = await (prisma.story as any).findMany({
    where: { userId: { in: userIds }, expiresAt: { gt: now }, archivedAt: null },
    include: {
      user: { include: { profile: true } },
      views: { where: { userId: myId } },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((s: any) => ({
    id: s.id,
    userId: s.userId,
    mediaUrl: s.mediaUrl,
    type: s.type as "IMAGE" | "VIDEO" | "TEXT",
    textContent: s.textContent,
    textStyle: s.textStyle ? JSON.parse(s.textStyle) : null,
    stickers: s.stickers ? JSON.parse(s.stickers) : [],
    audience: s.audience,
    createdAt: s.createdAt,
    user: {
      profile: {
        displayName: s.user.profile?.displayName ?? "User",
        avatarUrl: s.user.profile?.avatarUrl ?? null,
        username: s.user.profile?.username ?? "user",
      },
    },
    viewed: s.views.length > 0,
    isOwn: s.userId === myId,
  }));
}

// ─── Create Media Story ───────────────────────────────────────────────────────
export async function createStory(data: {
  mediaUrl: string;
  type: "IMAGE" | "VIDEO";
  audience?: string;
  stickers?: any[];
}) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);
    const story = await prisma.story.create({
      data: {
        userId: session.user.id,
        mediaUrl: data.mediaUrl,
        type: data.type,
        expiresAt,
      },
    });
    revalidatePath("/");
    return { success: true, story };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── Create Text Story ────────────────────────────────────────────────────────
export async function createTextStory(data: {
  textContent: string;
  textStyle: { bg: string; font: string; color: string };
  audience?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);
    const story = await (prisma.story as any).create({
      data: {
        userId: session.user.id,
        type: "TEXT",
        textContent: data.textContent,
        textStyle: JSON.stringify(data.textStyle),
        expiresAt,
      },
    });
    revalidatePath("/");
    return { success: true, story };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── Mark Viewed ──────────────────────────────────────────────────────────────
export async function markStoryViewed(storyId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await prisma.storyView.upsert({
      where: { storyId_userId: { storyId, userId: session.user.id } },
      create: { storyId, userId: session.user.id },
      update: {},
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── Get Viewers (own stories only) ───────────────────────────────────────────
export async function getStoryViewers(storyId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, viewers: [] };

  try {
    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story || story.userId !== session.user.id) {
      return { success: false, viewers: [] };
    }
    const views = await prisma.storyView.findMany({
      where: { storyId },
      orderBy: { viewedAt: "desc" },
    });
    // Return basic data — join via userId
    const viewerIds = views.map((v: any) => v.userId);
    const profiles = await prisma.profile.findMany({
      where: { userId: { in: viewerIds } },
    });
    const profileMap = Object.fromEntries(profiles.map((p: any) => [p.userId, p]));
    return {
      success: true,
      viewers: views.map((v: any) => ({
        userId: v.userId,
        viewedAt: v.viewedAt,
        displayName: profileMap[v.userId]?.displayName ?? "User",
        avatarUrl: profileMap[v.userId]?.avatarUrl ?? null,
        username: profileMap[v.userId]?.username ?? "user",
      })),
    };
  } catch (error: any) {
    return { success: false, viewers: [], error: error.message };
  }
}

// ─── Archive Story ────────────────────────────────────────────────────────────
export async function archiveStory(storyId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    // Use prisma.$executeRaw to set archivedAt since the field exists in schema
    await prisma.$executeRaw`UPDATE "Story" SET "archivedAt" = datetime('now') WHERE id = ${storyId} AND "userId" = ${session.user.id}`;
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── Create Highlight ────────────────────────────────────────────────────────
export async function createHighlight(title: string, coverUrl?: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    // Use raw for models that haven't been generated yet
    const id = crypto.randomUUID();
    await prisma.$executeRaw`INSERT INTO "StoryHighlight" (id, "userId", title, "coverUrl", "sortOrder", "createdAt", "updatedAt") VALUES (${id}, ${session.user.id}, ${title}, ${coverUrl ?? null}, 0, datetime('now'), datetime('now'))`;
    revalidatePath("/");
    return { success: true, highlight: { id, title, coverUrl } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── Add Story to Highlight ───────────────────────────────────────────────────
export async function addToHighlight(highlightId: string, storyId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const id = crypto.randomUUID();
    await prisma.$executeRaw`INSERT OR IGNORE INTO "HighlightStory" (id, "highlightId", "storyId", "sortOrder", "createdAt") VALUES (${id}, ${highlightId}, ${storyId}, 0, datetime('now'))`;
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── Get My Highlights ────────────────────────────────────────────────────────
export async function getMyHighlights() {
  const session = await auth();
  if (!session?.user?.id) return [];

  try {
    const rows = await prisma.$queryRaw`
      SELECT h.id, h.title, h."coverUrl", s."mediaUrl", s."textContent", s."textStyle"
      FROM "StoryHighlight" h
      LEFT JOIN "HighlightStory" hs ON hs."highlightId" = h.id
      LEFT JOIN "Story" s ON s.id = hs."storyId"
      WHERE h."userId" = ${session.user.id}
      ORDER BY h."sortOrder" ASC, hs."sortOrder" ASC
    ` as any[];

    // Group by highlight
    const map = new Map<string, any>();
    for (const row of rows) {
      if (!map.has(row.id)) {
        map.set(row.id, { id: row.id, title: row.title, coverUrl: row.coverUrl, storyCount: 0 });
      }
      if (row.mediaUrl || row.textContent) {
        map.get(row.id).storyCount++;
        if (!map.get(row.id).coverUrl) {
          map.get(row.id).coverUrl = row.mediaUrl;
        }
      }
    }
    return Array.from(map.values());
  } catch {
    return [];
  }
}
