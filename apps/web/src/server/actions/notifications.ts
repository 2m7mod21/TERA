"use server";

import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type NotificationType =
  | "FOLLOW"
  | "FRIEND_REQUEST"
  | "FRIEND_ACCEPT"
  | "REACTION"
  | "COMMENT"
  | "REPLY"
  | "MENTION"
  | "TAG"
  | "SHARE"
  | "SAVE"
  | "REPOST"
  | "MESSAGE"
  | "MESSAGE_REACTION"
  | "STORY_VIEW"
  | "STORY_REACTION"
  | "STORY_REPLY"
  | "STORY_MENTION"
  | "GROUP_INVITE"
  | "EVENT_INVITE"
  | "POST_APPROVED"
  | "POST_REMOVED"
  | "ACCOUNT_VERIFIED"
  | "SECURITY_ALERT"
  | "LOGIN_ALERT"
  | "SYSTEM"
  | "ACHIEVEMENT"
  | "ADMIN";

export async function getNotifications(filter: "all" | "unread" = "all", limit = 40, cursor?: string) {
  const session = await auth();
  if (!session?.user) return { notifications: [], nextCursor: null };
  try {
    const items = await prisma.notification.findMany({
      where: {
        receiverId: session.user.id,
        ...(filter === "unread" ? { isRead: false } : {}),
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      take: limit + 1,
      include: { sender: { include: { profile: true } } },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
    const hasMore = items.length > limit;
    const notifications = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? (notifications[notifications.length - 1]?.createdAt.toISOString() ?? null) : null;
    return { notifications, nextCursor };
  } catch (error) {
    console.error("getNotifications error:", error);
    return { notifications: [], nextCursor: null };
  }
}

export async function getUnreadCount() {
  const session = await auth();
  if (!session?.user) return 0;
  try {
    return prisma.notification.count({
      where: { receiverId: session.user.id, isRead: false },
    });
  } catch {
    return 0;
  }
}

export async function markNotificationAsRead(id: string) {
  const session = await auth();
  if (!session?.user) return { success: false };
  try {
    await prisma.notification.update({
      where: { id, receiverId: session.user.id },
      data: { isRead: true },
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function markNotificationAsUnread(id: string) {
  const session = await auth();
  if (!session?.user) return { success: false };
  try {
    await prisma.notification.update({
      where: { id, receiverId: session.user.id },
      data: { isRead: false },
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function markAllRead() {
  const session = await auth();
  if (!session?.user) return { success: false };
  try {
    await prisma.notification.updateMany({
      where: { receiverId: session.user.id, isRead: false },
      data: { isRead: true },
    });
    revalidatePath("/notifications");
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function deleteNotification(id: string) {
  const session = await auth();
  if (!session?.user) return { success: false };
  try {
    await prisma.notification.delete({
      where: { id, receiverId: session.user.id },
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function deleteAllNotifications() {
  const session = await auth();
  if (!session?.user) return { success: false };
  try {
    await prisma.notification.deleteMany({
      where: { receiverId: session.user.id },
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function createNotification(data: {
  receiverId: string;
  senderId?: string;
  type: NotificationType;
  entityId?: string;
  entityType?: string;
  priority?: number;
  groupKey?: string;
  metadata?: string;
}) {
  try {
    // Never notify yourself
    if (data.senderId && data.receiverId === data.senderId) return null;

    // Respect granular notification settings (Push Preference)
    const CATEGORY_MAP: Record<string, string> = {
      FOLLOW: "FOLLOWS",
      FRIEND_REQUEST: "FOLLOWS",
      FRIEND_ACCEPT: "FOLLOWS",
      REACTION: "LIKES",
      STORY_REACTION: "LIKES",
      COMMENT: "COMMENTS",
      REPLY: "COMMENTS",
      STORY_REPLY: "COMMENTS",
      MESSAGE: "MESSAGES",
      GROUP_INVITE: "MESSAGES",
      MENTION: "MENTIONS",
      TAG: "MENTIONS",
      STORY_MENTION: "MENTIONS",
    };
    const cat = CATEGORY_MAP[data.type];
    if (cat) {
      const pref = await prisma.notificationPreference.findFirst({
        where: { userId: data.receiverId, category: cat as any },
      });
      if (pref && pref.push === false) {
        return null;
      }
    }

    // Prevent duplicate: same sender+receiver+type+entityId within 30s
    if (data.senderId && data.entityId) {
      const recent = await prisma.notification.findFirst({
        where: {
          receiverId: data.receiverId,
          senderId: data.senderId,
          type: data.type,
          entityId: data.entityId,
          createdAt: { gte: new Date(Date.now() - 30_000) },
        },
      });
      if (recent) return recent;
    }

    const n = await prisma.notification.create({
      data: {
        receiverId: data.receiverId,
        senderId: data.senderId ?? null,
        type: data.type,
        entityId: data.entityId ?? null,
        entityType: data.entityType ?? null,
        priority: data.priority ?? 0,
        groupKey: data.groupKey ?? null,
        // @ts-ignore (Next.js/TS might cache old client types occasionally)
        metadata: data.metadata ?? null,
      },
      include: { sender: { include: { profile: true } } },
    });
    return n;
  } catch (error) {
    console.error("createNotification error:", error);
    return null;
  }
}
