import { Server, Socket } from "socket.io";
import { prisma } from "@/lib/db";

// userId -> Set of socketIds
const activeConnections = new Map<string, Set<string>>();

// Global io reference so server actions can emit notifications
let _io: Server | null = null;

export function getIO(): Server | null {
  return _io;
}

/** Emit a notification to a specific user (from any server action). */
export function emitNotification(targetUserId: string, notification: unknown) {
  if (_io) {
    _io.to(targetUserId).emit("notification:new", notification);
  }
}

export function initSocketServer(io: Server) {
  _io = io;

  io.on("connection", async (socket: Socket) => {
    const userId = socket.handshake.query.userId as string | undefined;

    if (userId) {
      const sockets = activeConnections.get(userId) ?? new Set<string>();
      sockets.add(socket.id);
      activeConnections.set(userId, sockets);

      // Join personal room for notifications
      socket.join(userId);

      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { showOnlineStatus: true },
        });
        if (user && user.showOnlineStatus !== "NOBODY") {
          socket.broadcast.emit("presence:online", { userId });
        }
      } catch (e) {
        console.error("[socket] presence connect error", e);
      }

      console.log(`[socket] User ${userId} connected (${socket.id})`);
    }

    // ─── Presence ───────────────────────────────────────────────────────────
    socket.on(
      "presence:get",
      async ({ targetUserId, viewerId }: { targetUserId: string; viewerId: string }) => {
        try {
          const target = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: {
              showOnlineStatus: true,
              showLastSeen: true,
              lastSeenAt: true,
              followers: { where: { followerId: viewerId }, select: { id: true } },
            },
          });
          if (!target) return;

          const isOnline = activeConnections.has(targetUserId);
          const isFriend = target.followers.length > 0;
          const canSeeOnline =
            target.showOnlineStatus === "EVERYONE" ||
            (target.showOnlineStatus === "FRIENDS" && isFriend);
          const canSeeLastSeen =
            target.showLastSeen === "EVERYONE" ||
            (target.showLastSeen === "FRIENDS" && isFriend);

          socket.emit("presence:res", {
            userId: targetUserId,
            online: isOnline && canSeeOnline,
            lastSeenAt: canSeeLastSeen ? target.lastSeenAt : null,
          });
        } catch (e) {
          console.error("[socket] presence:get error", e);
        }
      }
    );

    // ─── Conversation rooms ──────────────────────────────────────────────────
    socket.on("conversation:join", (conversationId: string) => {
      socket.join(conversationId);
    });
    socket.on("conversation:leave", (conversationId: string) => {
      socket.leave(conversationId);
    });

    // ─── Typing ─────────────────────────────────────────────────────────────
    socket.on(
      "typing:start",
      async (data: { conversationId: string; userId: string; username: string }) => {
        try {
          const user = await prisma.user.findUnique({
            where: { id: data.userId },
            select: { showTypingIndicator: true },
          });
          if (user?.showTypingIndicator !== false) {
            socket.to(data.conversationId).emit("typing:start", data);
          }
        } catch {
          socket.to(data.conversationId).emit("typing:start", data);
        }
      }
    );
    socket.on("typing:stop", (data: { conversationId: string; userId: string }) => {
      socket.to(data.conversationId).emit("typing:stop", data);
    });

    // ─── Messages ───────────────────────────────────────────────────────────
    socket.on("message:send", (data: {
      id: string; conversationId: string; senderId: string;
      content?: string; mediaUrl?: string; mediaType?: string;
      replyToId?: string; createdAt: string;
    }) => {
      socket.to(data.conversationId).emit("message:receive", data);
    });

    socket.on("message:edit", (data: { messageId: string; conversationId: string; content: string }) => {
      socket.to(data.conversationId).emit("message:edited", data);
    });

    socket.on("message:delete", (data: { messageId: string; conversationId: string; forAll: boolean }) => {
      socket.to(data.conversationId).emit("message:deleted", data);
    });

    socket.on("message:react", (data: { messageId: string; conversationId: string; userId: string; emoji: string }) => {
      socket.to(data.conversationId).emit("message:reacted", data);
    });

    // ─── Delivery ────────────────────────────────────────────────────────────
    socket.on("message:delivered", async (data: {
      conversationId: string; messageIds: string[]; userId: string;
    }) => {
      try {
        for (const msgId of data.messageIds) {
          const msg = await prisma.message.findUnique({ where: { id: msgId } });
          if (msg) {
            let delivered: string[] = [];
            try { delivered = JSON.parse((msg as any).deliveredTo ?? "[]"); } catch { delivered = []; }
            if (!delivered.includes(data.userId)) {
              delivered.push(data.userId);
              await prisma.message.update({
                where: { id: msgId },
                data: { deliveredTo: JSON.stringify(delivered) } as any,
              });
            }
          }
        }
        socket.to(data.conversationId).emit("message:delivered", {
          messageIds: data.messageIds,
          userId: data.userId,
        });
      } catch (e) {
        console.error("[socket] message:delivered error", e);
      }
    });

    // ─── Read receipts ───────────────────────────────────────────────────────
    socket.on("message:read", async (data: {
      conversationId: string; userId: string; messageIds: string[]; lastReadAt: string;
    }) => {
      try {
        for (const msgId of (data.messageIds ?? [])) {
          const msg = await prisma.message.findUnique({ where: { id: msgId } });
          if (msg) {
            let readBy: string[] = [];
            try { readBy = JSON.parse(msg.readBy ?? "[]"); } catch { readBy = []; }
            if (!readBy.includes(data.userId)) {
              readBy.push(data.userId);
              await prisma.message.update({
                where: { id: msgId },
                data: { readBy: JSON.stringify(readBy) },
              });
            }
          }
        }
      } catch (e) {
        console.error("[socket] message:read persist error", e);
      }
      socket.to(data.conversationId).emit("message:read", data);
    });

    // ─── Notification events from client ─────────────────────────────────────
    socket.on("notification:read", (data: { id: string; userId: string }) => {
      // Sync across tabs: emit back to all user's devices
      if (data.userId) {
        io.to(data.userId).emit("notification:read", { id: data.id });
      }
    });
    socket.on("notification:read_all", (data: { userId: string }) => {
      if (data.userId) {
        io.to(data.userId).emit("notification:read_all");
      }
    });

    // ─── Post real-time updates ──────────────────────────────────────────────
    socket.on("post:join", (postId: string) => { socket.join(`post:${postId}`); });
    socket.on("post:leave", (postId: string) => { socket.leave(`post:${postId}`); });

    socket.on("post:reaction", (data: {
      postId: string; userId: string; type: string;
      counts: Record<string, number>; total: number;
    }) => {
      io.to(`post:${data.postId}`).emit("post:reaction:update", data);
    });

    socket.on("post:comment", (data: {
      postId: string; commentId: string; parentId?: string;
      userId: string; content: string; createdAt: string;
    }) => {
      io.to(`post:${data.postId}`).emit("post:comment:new", data);
    });

    // ─── WebRTC Signaling ───────────────────────────────────────────────────
    socket.on("webrtc:offer", (data: {
      targetUserId: string; offer: RTCSessionDescriptionInit;
      conversationId: string; callType: "audio" | "video";
    }) => {
      socket.to(data.targetUserId).emit("webrtc:offer", {
        senderId: userId, offer: data.offer,
        conversationId: data.conversationId, callType: data.callType,
      });
    });

    socket.on("webrtc:answer", (data: { targetUserId: string; answer: RTCSessionDescriptionInit }) => {
      socket.to(data.targetUserId).emit("webrtc:answer", { senderId: userId, answer: data.answer });
    });

    socket.on("webrtc:ice-candidate", (data: { targetUserId: string; candidate: RTCIceCandidateInit }) => {
      socket.to(data.targetUserId).emit("webrtc:ice-candidate", { senderId: userId, candidate: data.candidate });
    });

    socket.on("webrtc:call-end", (data: { targetUserId: string; conversationId: string }) => {
      socket.to(data.targetUserId).emit("webrtc:call-end", { senderId: userId, conversationId: data.conversationId });
    });

    // ─── Disconnect ──────────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
      if (userId) {
        const sockets = activeConnections.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            activeConnections.delete(userId);
            const now = new Date();
            try {
              await prisma.user.update({
                where: { id: userId },
                data: { lastSeenAt: now } as any,
              });
              const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { showOnlineStatus: true },
              });
              if (user && user.showOnlineStatus !== "NOBODY") {
                socket.broadcast.emit("presence:offline", {
                  userId, lastSeenAt: now.toISOString(),
                });
              }
            } catch (e) {
              console.error("[socket] disconnect update error", e);
            }
          }
        }
        console.log(`[socket] User ${userId} disconnected (${socket.id})`);
      }
    });
  });
}

export function emitToUser(io: Server, targetUserId: string, event: string, data: unknown) {
  io.to(targetUserId).emit(event, data);
}

export function isUserOnline(userId: string): boolean {
  return (activeConnections.get(userId)?.size ?? 0) > 0;
}

export function getOnlineUserIds(): string[] {
  return Array.from(activeConnections.keys());
}
