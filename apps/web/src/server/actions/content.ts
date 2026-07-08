"use server";

import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createStory(mediaUrl: string, type: "IMAGE" | "VIDEO" = "IMAGE") {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const story = await prisma.story.create({
      data: {
        userId: session.user.id,
        mediaUrl,
        type,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      },
    });
    revalidatePath("/");
    return { success: true, story };
  } catch (error) {
    console.error("Create story Action error:", error);
    return { success: false, error: "Failed to create story" };
  }
}

export async function viewStory(storyId: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await prisma.storyView.upsert({
      where: {
        storyId_userId: {
          storyId,
          userId: session.user.id,
        },
      },
      update: {},
      create: {
        storyId,
        userId: session.user.id,
      },
    });
    return { success: true };
  } catch (error) {
    console.error("View story Action error:", error);
    return { success: false, error: "Failed to record story view" };
  }
}

export async function reactToStory(storyId: string, emoji: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const rx = await prisma.storyReaction.create({
      data: {
        storyId,
        userId: session.user.id,
        type: emoji,
      },
    });
    return { success: true, reaction: rx };
  } catch (error) {
    console.error("React story Action error:", error);
    return { success: false, error: "Failed to react to story" };
  }
}

export async function getActiveStories() {
  const session = await auth();
  if (!session?.user) {
    return [];
  }

  try {
    // Get list of followed authors
    const follows = await prisma.follow.findMany({
      where: { followerId: session.user.id },
      select: { followeeId: true },
    });
    const followeeIds = follows.map((f: { followeeId: string }) => f.followeeId);

    // Also include own stories
    const authors = [session.user.id, ...followeeIds];

    return prisma.story.findMany({
      where: {
        userId: { in: authors },
        expiresAt: { gt: new Date() }, // Not expired
      },
      include: {
        user: { include: { profile: true } },
        views: true,
        reactions: true,
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Get active stories Action error:", error);
    return [];
  }
}

export async function createReel(videoUrl: string, caption?: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const reel = await prisma.reel.create({
      data: {
        userId: session.user.id,
        videoUrl,
        caption: caption || null,
      },
    });
    revalidatePath("/reels");
    return { success: true, reel };
  } catch (error) {
    console.error("Create reel Action error:", error);
    return { success: false, error: "Failed to create reel" };
  }
}

export async function getReels(limit = 10) {
  try {
    return prisma.reel.findMany({
      take: limit,
      include: {
        user: { include: { profile: true } },
        reactions: true,
        comments: {
          include: { user: { include: { profile: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Get reels error:", error);
    return [];
  }
}
