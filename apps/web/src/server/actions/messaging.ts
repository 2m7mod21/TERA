"use server";

import { auth } from "@/server/auth/config";
import { MessageRepository } from "@/server/repositories/message.repository";
import { messageCreateSchema } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export async function getInbox() {
  const session = await auth();
  if (!session?.user) return [];
  try {
    return await MessageRepository.getConversations(session.user.id);
  } catch (error) {
    console.error("Get inbox error:", error);
    return [];
  }
}

export async function getConversationMessages(conversationId: string) {
  const session = await auth();
  if (!session?.user) return [];
  try {
    return await MessageRepository.getConversationMessages(conversationId);
  } catch (error) {
    console.error("Get messages error:", error);
    return [];
  }
}

// Client-callable version (used in inline chat panel)
export async function getChatMessagesClient(conversationId: string) {
  const session = await auth();
  if (!session?.user) return [];
  try {
    return await MessageRepository.getConversationMessages(conversationId);
  } catch (error) {
    console.error("Get chat messages error:", error);
    return [];
  }
}

export async function createDM(targetUserId: string) {
  const session = await auth();
  if (!session?.user) return { success: false as const };
  try {
    const conversation = await MessageRepository.findOrCreateDM(session.user.id, targetUserId);
    revalidatePath("/messages");
    return { success: true as const, conversation };
  } catch (error) {
    console.error("Create DM error:", error);
    return { success: false as const };
  }
}

export async function createGroupConversation(name: string, memberIds: string[], avatarUrl?: string) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };
  try {
    const conversation = await MessageRepository.createGroupConversation(name, session.user.id, memberIds, avatarUrl);
    revalidatePath("/messages");
    return {
      success: true as const,
      conversation: {
        id: conversation.id,
        name: conversation.name,
        avatarUrl: conversation.avatarUrl,
        isGroup: conversation.isGroup,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    console.error("Create group DM error:", error);
    return { success: false as const, error: "Failed to create group" };
  }
}

export async function saveMessage(data: {
  conversationId: string;
  content?: string;
  mediaUrl?: string;
  mediaType?: string;
  replyToId?: string;
}) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };

  const result = messageCreateSchema.safeParse(data);
  if (!result.success) return { success: false as const, error: result.error.flatten().fieldErrors };

  try {
    const message = await MessageRepository.saveMessage({
      senderId: session.user.id,
      ...result.data,
      replyToId: data.replyToId,
    });
    revalidatePath(`/messages/${result.data.conversationId}`);
    return { success: true as const, message };
  } catch (error) {
    console.error("Save message error:", error);
    return { success: false as const, error: { global: "Failed to send message" } };
  }
}

export async function editMessage(messageId: string, newContent: string) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };
  try {
    const msg = await prisma.message.findUnique({ where: { id: messageId } });
    if (!msg || msg.senderId !== session.user.id) return { success: false as const, error: "Forbidden" };
    const updated = await (prisma.message as any).update({
      where: { id: messageId },
      data: { content: newContent.trim(), isEdited: true, editedAt: new Date() },
    });
    revalidatePath(`/messages/${msg.conversationId}`);
    return { success: true as const, message: updated };
  } catch (error) {
    console.error("Edit message error:", error);
    return { success: false as const, error: "Failed to edit message" };
  }
}

export async function deleteMessage(messageId: string) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };
  try {
    const msg = await prisma.message.findUnique({ where: { id: messageId } });
    if (!msg || msg.senderId !== session.user.id) return { success: false as const, error: "Forbidden" };
    const updated = await (prisma.message as any).update({
      where: { id: messageId },
      data: { content: null, mediaUrl: null, deletedForAll: true },
    });
    revalidatePath(`/messages/${msg.conversationId}`);
    return { success: true as const, message: updated };
  } catch (error) {
    console.error("Delete message error:", error);
    return { success: false as const, error: "Failed to delete message" };
  }
}

export async function reactToMessage(messageId: string, emoji: string) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };
  try {
    const msg = await (prisma.message as any).findUnique({ where: { id: messageId } });
    if (!msg) return { success: false as const, error: "Message not found" };

    let reactions: Array<{ userId: string; emoji: string }> = [];
    try { reactions = JSON.parse((msg as any).reactions ?? "[]"); } catch { reactions = []; }

    const existing = reactions.findIndex((r) => r.userId === session.user.id);
    const existingEntry = existing >= 0 ? reactions[existing] : undefined;
    if (existingEntry && existingEntry.emoji === emoji) {
      reactions.splice(existing, 1);
    } else if (existingEntry) {
      existingEntry.emoji = emoji;
    } else {
      reactions.push({ userId: session.user.id, emoji });
    }

    const updated = await (prisma.message as any).update({
      where: { id: messageId },
      data: { reactions: JSON.stringify(reactions) },
    });
    return { success: true as const, message: updated };
  } catch (error) {
    console.error("React to message error:", error);
    return { success: false as const, error: "Failed to react" };
  }
}

export async function markAsRead(messageIds: string[]) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };
  try {
    await MessageRepository.markAsRead(messageIds, session.user.id);
    return { success: true as const };
  } catch (error) {
    console.error("Mark read error:", error);
    return { success: false as const, error: "Failed to mark as read" };
  }
}

export async function markAsDelivered(messageIds: string[]) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };
  try {
    for (const id of messageIds) {
      const msg = await prisma.message.findUnique({ where: { id } });
      if (msg) {
        let delivered: string[] = [];
        try { delivered = JSON.parse((msg as any).deliveredTo ?? "[]"); } catch { delivered = []; }
        if (!delivered.includes(session.user.id)) {
          delivered.push(session.user.id);
          await prisma.message.update({
            where: { id },
            data: { deliveredTo: JSON.stringify(delivered) } as any,
          });
        }
      }
    }
    return { success: true as const };
  } catch (error) {
    console.error("Mark delivered error:", error);
    return { success: false as const, error: "Failed to mark as delivered" };
  }
}

export async function updateConversationSettings(conversationId: string, settings: {
  isMuted?: boolean;
  isArchived?: boolean;
  isPinned?: boolean;
}) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };
  try {
    await (prisma.conversationParticipant as any).update({
      where: {
        conversationId_userId: { conversationId, userId: session.user.id },
      },
      data: settings,
    });
    revalidatePath("/messages");
    return { success: true as const };
  } catch (error) {
    console.error("Update conversation settings error:", error);
    return { success: false as const, error: "Failed to update" };
  }
}

export async function leaveGroupConversation(conversationId: string) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };
  try {
    await prisma.conversationParticipant.delete({
      where: {
        conversationId_userId: { conversationId, userId: session.user.id },
      },
    });
    revalidatePath("/messages");
    return { success: true as const };
  } catch (error) {
    console.error("Leave group error:", error);
    return { success: false as const, error: "Failed to leave group" };
  }
}

export async function getConversationParticipants(conversationId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];
  try {
    const participants = await prisma.conversationParticipant.findMany({
      where: { conversationId },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });
    return participants.map((p) => ({
      userId: p.userId,
      role: p.role, // ADMIN, MEMBER
      displayName: p.user.profile?.displayName || p.user.email || "Member",
      username: p.user.profile?.username || "member",
      avatarUrl: p.user.profile?.avatarUrl || null,
    }));
  } catch (error) {
    console.error("Get conversation participants error:", error);
    return [];
  }
}

export async function addGroupMembers(conversationId: string, userIds: string[]) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  try {
    const requester = await prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: session.user.id, role: "ADMIN" },
    });
    if (!requester) return { success: false, error: "Only admins can add members" };

    const existing = await prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { in: userIds } },
      select: { userId: true },
    });
    const existingIds = new Set(existing.map((p) => p.userId));
    const toAdd = userIds.filter((id) => !existingIds.has(id));

    if (toAdd.length > 0) {
      await prisma.conversationParticipant.createMany({
        data: toAdd.map((userId) => ({
          conversationId,
          userId,
          role: "MEMBER",
        })),
      });
    }

    revalidatePath("/messages");
    return { success: true };
  } catch (error) {
    console.error("Add group members error:", error);
    return { success: false, error: "Failed to add members" };
  }
}

export async function promoteGroupMember(conversationId: string, memberId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  try {
    const requester = await prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: session.user.id, role: "ADMIN" },
    });
    if (!requester) return { success: false, error: "Only admins can change roles" };

    await prisma.conversationParticipant.update({
      where: {
        conversationId_userId: { conversationId, userId: memberId },
      },
      data: { role: "ADMIN" },
    });
    revalidatePath("/messages");
    return { success: true };
  } catch (error) {
    console.error("Promote group member error:", error);
    return { success: false, error: "Failed to promote" };
  }
}

export async function demoteGroupMember(conversationId: string, memberId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  try {
    // requester must be admin
    const requester = await prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: session.user.id, role: "ADMIN" },
    });
    if (!requester) return { success: false, error: "Only admins can change roles" };

    // Demoted to member
    await prisma.conversationParticipant.update({
      where: {
        conversationId_userId: { conversationId, userId: memberId },
      },
      data: { role: "MEMBER" },
    });
    revalidatePath("/messages");
    return { success: true };
  } catch (error) {
    console.error("Demote group member error:", error);
    return { success: false, error: "Failed to demote" };
  }
}

export async function removeGroupMember(conversationId: string, memberId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  try {
    const requester = await prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: session.user.id, role: "ADMIN" },
    });
    if (!requester) return { success: false, error: "Only admins can remove members" };

    await prisma.conversationParticipant.delete({
      where: {
        conversationId_userId: { conversationId, userId: memberId },
      },
    });
    revalidatePath("/messages");
    return { success: true };
  } catch (error) {
    console.error("Remove group member error:", error);
    return { success: false, error: "Failed to remove member" };
  }
}

export async function updateGroupSettings(
  conversationId: string,
  settings: { name?: string; description?: string; adminsOnly?: boolean; avatarUrl?: string }
) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  try {
    const requester = await prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: session.user.id, role: "ADMIN" },
    });
    if (!requester) return { success: false, error: "Only admins can modify settings" };

    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) return { success: false, error: "Conversation not found" };

    let currentJson: any = {};
    try {
      currentJson = JSON.parse(conv.description || "{}");
    } catch {
      currentJson = { text: conv.description || "" };
    }
    if (typeof currentJson !== "object" || currentJson === null) {
      currentJson = { text: String(currentJson) };
    }

    if (settings.description !== undefined) currentJson.text = settings.description;
    if (settings.adminsOnly !== undefined) currentJson.adminsOnly = settings.adminsOnly;

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        name: settings.name !== undefined ? settings.name : undefined,
        avatarUrl: settings.avatarUrl !== undefined ? settings.avatarUrl : undefined,
        description: JSON.stringify(currentJson),
      },
    });
    revalidatePath("/messages");
    return { success: true };
  } catch (error) {
    console.error("Update group settings error:", error);
    return { success: false, error: "Failed to update group settings" };
  }
}
