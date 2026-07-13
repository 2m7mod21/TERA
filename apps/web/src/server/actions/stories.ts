"use server";

import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

// ─── Get Active Stories (with ranking) ───────────────────────────────────────
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
      reactions: { where: { userId: myId } },
      _count: { select: { views: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Ranking: own first, then unseen, then seen — within each group sort by recency
  const scored = rows.map((s: any) => {
    let score = 0;
    if (s.userId === myId) score += 1000;
    if (s.views.length === 0) score += 100;
    return { ...s, _score: score };
  });
  scored.sort((a: any, b: any) => b._score - a._score || b.createdAt - a.createdAt);

  return scored.map((s: any) => ({
    id: s.id,
    userId: s.userId,
    mediaUrl: s.mediaUrl,
    type: s.type as "IMAGE" | "VIDEO" | "TEXT",
    textContent: s.textContent,
    textStyle: s.textStyle ? JSON.parse(s.textStyle) : null,
    stickers: s.stickers ? JSON.parse(s.stickers) : [],
    audience: s.audience,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    viewCount: s._count?.views ?? 0,
    user: {
      profile: {
        displayName: s.user.profile?.displayName ?? "User",
        avatarUrl: s.user.profile?.avatarUrl ?? null,
        username: s.user.profile?.username ?? "user",
      },
    },
    viewed: s.views.length > 0,
    isOwn: s.userId === myId,
    myReaction: s.reactions?.[0]?.type ?? null,
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
    const story = await (prisma.story as any).create({
      data: {
        userId: session.user.id,
        mediaUrl: data.mediaUrl,
        type: data.type,
        audience: data.audience ?? "PUBLIC",
        stickers: JSON.stringify(data.stickers ?? []),
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
  stickers?: any[];
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
        audience: data.audience ?? "PUBLIC",
        stickers: JSON.stringify(data.stickers ?? []),
        expiresAt,
      },
    });
    revalidatePath("/");
    return { success: true, story };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── React to Story ───────────────────────────────────────────────────────────
export async function reactToStory(storyId: string, reaction: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  try {
    await prisma.storyReaction.upsert({
      where: { storyId_userId: { storyId, userId: session.user.id } },
      create: { storyId, userId: session.user.id, type: reaction },
      update: { type: reaction },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── Mark Viewed ──────────────────────────────────────────────────────────────
export async function markStoryViewed(storyId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

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

// ─── Get Story Viewers ────────────────────────────────────────────────────────
export async function getStoryViewers(storyId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, viewers: [] };

  try {
    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story || story.userId !== session.user.id) return { success: false, viewers: [] };

    const views = await prisma.storyView.findMany({
      where: { storyId },
      orderBy: { viewedAt: "desc" },
    });
    const viewerIds = views.map((v: any) => v.userId);
    const profiles = await prisma.profile.findMany({ where: { userId: { in: viewerIds } } });
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
  if (!session?.user?.id) return { success: false };

  try {
    await (prisma.story as any).updateMany({
      where: { id: storyId, userId: session.user.id },
      data: { archivedAt: new Date() },
    });
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── Delete Story ─────────────────────────────────────────────────────────────
export async function deleteStory(storyId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  try {
    await prisma.story.delete({ where: { id: storyId, userId: session.user.id } });
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── Get Archived Stories ─────────────────────────────────────────────────────
export async function getArchivedStories() {
  const session = await auth();
  if (!session?.user?.id) return [];

  try {
    const rows = await (prisma.story as any).findMany({
      where: { userId: session.user.id, archivedAt: { not: null } },
      include: { user: { include: { profile: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((s: any) => ({
      id: s.id,
      userId: s.userId,
      mediaUrl: s.mediaUrl,
      type: s.type,
      textContent: s.textContent,
      textStyle: s.textStyle ? JSON.parse(s.textStyle) : null,
      stickers: s.stickers ? JSON.parse(s.stickers) : [],
      createdAt: s.createdAt,
      archivedAt: s.archivedAt,
      user: {
        profile: {
          displayName: s.user.profile?.displayName ?? "User",
          avatarUrl: s.user.profile?.avatarUrl ?? null,
          username: s.user.profile?.username ?? "user",
        },
      },
      isOwn: true,
    }));
  } catch {
    return [];
  }
}

// ─── Create Highlight ─────────────────────────────────────────────────────────
export async function createHighlight(title: string, coverUrl?: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  try {
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
  if (!session?.user?.id) return { success: false };

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
      SELECT h.id, h.title, h."coverUrl", s."mediaUrl", s."textContent", s."textStyle", s.type
      FROM "StoryHighlight" h
      LEFT JOIN "HighlightStory" hs ON hs."highlightId" = h.id
      LEFT JOIN "Story" s ON s.id = hs."storyId"
      WHERE h."userId" = ${session.user.id}
      ORDER BY h."sortOrder" ASC, hs."sortOrder" ASC
    ` as any[];

    const map = new Map<string, any>();
    for (const row of rows) {
      if (!map.has(row.id)) {
        map.set(row.id, { id: row.id, title: row.title, coverUrl: row.coverUrl, storyCount: 0 });
      }
      if (row.mediaUrl || row.textContent) {
        map.get(row.id).storyCount++;
        if (!map.get(row.id).coverUrl) map.get(row.id).coverUrl = row.mediaUrl;
      }
    }
    return Array.from(map.values());
  } catch {
    return [];
  }
}
