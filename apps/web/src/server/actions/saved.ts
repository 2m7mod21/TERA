"use server";

import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getCollections() {
  const session = await auth();
  if (!session?.user?.id) return [];

  try {
    return prisma.bookmarkCollection.findMany({
      where: { userId: session.user.id },
      include: {
        _count: { select: { bookmarks: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("getCollections error:", error);
    return [];
  }
}

export async function createCollection(name: string, coverUrl?: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const col = await prisma.bookmarkCollection.create({
      data: {
        userId: session.user.id,
        name,
        coverUrl: coverUrl || null,
      },
    });
    revalidatePath("/saved");
    return { success: true, collection: col };
  } catch (error) {
    console.error("createCollection error:", error);
    return { success: false, error: "Failed to create collection" };
  }
}

export async function deleteCollection(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await prisma.bookmarkCollection.delete({
      where: { id, userId: session.user.id },
    });
    revalidatePath("/saved");
    return { success: true };
  } catch (error) {
    console.error("deleteCollection error:", error);
    return { success: false, error: "Failed to delete collection" };
  }
}

export async function savePost(postId: string, collectionId?: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const existing = await prisma.bookmark.findUnique({
      where: {
        userId_postId: {
          userId: session.user.id,
          postId,
        },
      },
    });

    if (existing) {
      // Just update collection
      await prisma.bookmark.update({
        where: { id: existing.id },
        data: { collectionId: collectionId || null },
      });
    } else {
      await prisma.bookmark.create({
        data: {
          userId: session.user.id,
          postId,
          collectionId: collectionId || null,
        },
      });
    }

    revalidatePath("/saved");
    return { success: true };
  } catch (error) {
    console.error("savePost error:", error);
    return { success: false, error: "Failed to save post" };
  }
}

export async function unsavePost(postId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await prisma.bookmark.delete({
      where: {
        userId_postId: {
          userId: session.user.id,
          postId,
        },
      },
    });
    revalidatePath("/saved");
    return { success: true };
  } catch (error) {
    console.error("unsavePost error:", error);
    return { success: false, error: "Failed to unsave post" };
  }
}

export async function getSavedPosts(collectionId?: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  try {
    const bookmarks = await prisma.bookmark.findMany({
      where: {
        userId: session.user.id,
        ...(collectionId ? { collectionId } : {}),
      },
      include: {
        post: {
          include: {
            user: { include: { profile: true } },
            reactions: true,
            _count: { select: { comments: true, reactions: true } },
            shares: { select: { userId: true, content: true } },
            bookmarks: {
              where: { userId: session.user.id },
              select: { id: true },
            },
            parentPost: {
              include: {
                user: { include: { profile: true } },
                reactions: true,
                poll: { include: { options: { include: { votes: true } } } },
                shares: { select: { userId: true, content: true } },
                _count: { select: { comments: true, reactions: true } },
              }
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return bookmarks.map((b) => b.post);
  } catch (error) {
    console.error("getSavedPosts error:", error);
    return [];
  }
}
