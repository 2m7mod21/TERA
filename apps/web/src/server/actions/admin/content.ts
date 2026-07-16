"use server";

import { prisma } from "@/lib/db";
import { requireAdmin, writeAuditLog } from "@/lib/adminAuth";
import { revalidatePath } from "next/cache";

const PAGE_SIZE = 25;

export type ContentFilters = {
  type?: string;
  cursor?: string;
  search?: string;
};

export async function getContent(filters: ContentFilters = {}) {
  await requireAdmin("content", "read");

  const where: Record<string, unknown> = {};
  if (filters.type) where.type = filters.type;
  if (filters.search) {
    where.OR = [
      { content: { contains: filters.search } },
      { user: { profile: { username: { contains: filters.search } } } },
    ];
  }

  const posts = await prisma.post.findMany({
    where,
    include: {
      user: { include: { profile: true } },
      _count: { select: { reactions: true, comments: true, reports: true } },
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });

  const hasMore = posts.length > PAGE_SIZE;
  const items = hasMore ? posts.slice(0, PAGE_SIZE) : posts;
  return { posts: items, nextCursor: hasMore ? items[items.length - 1]!.id : null };
}

export async function deletePost(postId: string) {
  const ctx = await requireAdmin("content", "delete");
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { content: true, userId: true } });
  await prisma.post.delete({ where: { id: postId } });
  await writeAuditLog(ctx.userId, "DELETE_POST", {
    targetType: "Post",
    targetId: postId,
    oldValue: { content: post?.content, userId: post?.userId },
  });
  revalidatePath("/admin/content");
  return { success: true };
}

export async function hidePost(postId: string, hidden: boolean) {
  const ctx = await requireAdmin("content", "write");
  // Soft-hide via visibility field
  await prisma.post.update({
    where: { id: postId },
    data: { visibility: hidden ? "PRIVATE" : "PUBLIC" },
  });
  await writeAuditLog(ctx.userId, hidden ? "HIDE_POST" : "UNHIDE_POST", {
    targetType: "Post",
    targetId: postId,
  });
  revalidatePath("/admin/content");
  return { success: true };
}

export async function pinPost(postId: string, pinned: boolean) {
  const ctx = await requireAdmin("content", "write");
  await prisma.post.update({ where: { id: postId }, data: { isPinned: pinned } });
  await writeAuditLog(ctx.userId, pinned ? "PIN_POST" : "UNPIN_POST", {
    targetType: "Post",
    targetId: postId,
  });
  revalidatePath("/admin/content");
  return { success: true };
}
