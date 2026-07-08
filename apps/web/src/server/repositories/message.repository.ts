import { prisma } from "@/lib/db";

export class MessageRepository {
  static async getConversations(userId: string) {
    const conversations = await prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      include: {
        participants: {
          include: { user: { include: { profile: true } } },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Enrich with unread count and other participant
    return conversations.map((conv) => {
      const otherParticipant = conv.participants.find((p) => p.userId !== userId);
      const lastMessage = conv.messages[0] ?? null;

      // Count unread: messages where readBy does not contain userId
      return {
        ...conv,
        otherUser: otherParticipant?.user ?? null,
        lastMessage,
      };
    });
  }

  static async getConversationMessages(conversationId: string) {
    return prisma.message.findMany({
      where: { conversationId, deletedForAll: false },
      include: {
        sender: { include: { profile: { select: { displayName: true, avatarUrl: true, username: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  static async findOrCreateDM(userA: string, userB: string) {
    const existing = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          { participants: { some: { userId: userA } } },
          { participants: { some: { userId: userB } } },
        ],
      },
      include: { participants: { include: { user: { include: { profile: true } } } } },
    });

    if (existing && existing.participants.length === 2) return existing;

    return prisma.$transaction(async (tx) => {
      const conv = await tx.conversation.create({ data: { isGroup: false } });
      await tx.conversationParticipant.createMany({
        data: [
          { conversationId: conv.id, userId: userA, role: "MEMBER" },
          { conversationId: conv.id, userId: userB, role: "MEMBER" },
        ],
      });
      return tx.conversation.findUnique({
        where: { id: conv.id },
        include: { participants: { include: { user: { include: { profile: true } } } } },
      });
    });
  }

  static async createGroupConversation(name: string, ownerId: string, memberIds: string[], avatarUrl?: string) {
    return prisma.$transaction(async (tx) => {
      const conv = await tx.conversation.create({
        data: { isGroup: true, name, avatarUrl: avatarUrl ?? null },
      });
      const participantsData = [
        { conversationId: conv.id, userId: ownerId, role: "ADMIN" },
        ...memberIds.map((userId) => ({ conversationId: conv.id, userId, role: "MEMBER" })),
      ];
      await tx.conversationParticipant.createMany({ data: participantsData });
      return conv;
    });
  }

  static async saveMessage(data: {
    conversationId: string;
    senderId: string;
    content?: string;
    mediaUrl?: string;
    mediaType?: string;
    replyToId?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId: data.conversationId,
          senderId: data.senderId,
          content: data.content ?? null,
          mediaUrl: data.mediaUrl ?? null,
          mediaType: data.mediaType ?? null,
          replyToId: data.replyToId ?? null,
        },
        include: {
          sender: { include: { profile: { select: { displayName: true, avatarUrl: true, username: true } } } },
        },
      });
      await tx.conversation.update({
        where: { id: data.conversationId },
        data: { updatedAt: new Date() },
      });
      return message;
    });
  }

  static async markAsRead(messageIds: string[], userId: string) {
    for (const messageId of messageIds) {
      const msg = await prisma.message.findUnique({ where: { id: messageId } });
      if (msg) {
        let currentRead: string[] = [];
        try { currentRead = JSON.parse(msg.readBy); } catch { currentRead = []; }
        if (!currentRead.includes(userId)) {
          currentRead.push(userId);
          await prisma.message.update({
            where: { id: messageId },
            data: { readBy: JSON.stringify(currentRead) },
          });
        }
      }
    }
  }
}
