"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = getIO;
exports.emitNotification = emitNotification;
exports.initSocketServer = initSocketServer;
exports.emitToUser = emitToUser;
exports.isUserOnline = isUserOnline;
exports.getOnlineUserIds = getOnlineUserIds;
const db_1 = require("@/lib/db");
// userId -> Set of socketIds
const activeConnections = new Map();
// Global io reference so server actions can emit notifications
let _io = null;
function getIO() {
    return _io;
}
/** Emit a notification to a specific user (from any server action). */
function emitNotification(targetUserId, notification) {
    if (_io) {
        _io.to(targetUserId).emit("notification:new", notification);
    }
}
function initSocketServer(io) {
    _io = io;
    io.on("connection", async (socket) => {
        const userId = socket.handshake.query.userId;
        if (userId) {
            const sockets = activeConnections.get(userId) ?? new Set();
            sockets.add(socket.id);
            activeConnections.set(userId, sockets);
            // Join personal room for notifications
            socket.join(userId);
            try {
                const user = await db_1.prisma.user.findUnique({
                    where: { id: userId },
                    select: { showOnlineStatus: true },
                });
                if (user && user.showOnlineStatus !== "NOBODY") {
                    socket.broadcast.emit("presence:online", { userId });
                }
            }
            catch (e) {
                console.error("[socket] presence connect error", e);
            }
            console.log(`[socket] User ${userId} connected (${socket.id})`);
        }
        // ─── Presence ───────────────────────────────────────────────────────────
        socket.on("presence:get", async ({ targetUserId, viewerId }) => {
            try {
                const target = await db_1.prisma.user.findUnique({
                    where: { id: targetUserId },
                    select: {
                        showOnlineStatus: true,
                        showLastSeen: true,
                        lastSeenAt: true,
                        followers: { where: { followerId: viewerId }, select: { id: true } },
                    },
                });
                if (!target)
                    return;
                const isOnline = activeConnections.has(targetUserId);
                const isFriend = target.followers.length > 0;
                const canSeeOnline = target.showOnlineStatus === "EVERYONE" ||
                    (target.showOnlineStatus === "FRIENDS" && isFriend);
                const canSeeLastSeen = target.showLastSeen === "EVERYONE" ||
                    (target.showLastSeen === "FRIENDS" && isFriend);
                socket.emit("presence:res", {
                    userId: targetUserId,
                    online: isOnline && canSeeOnline,
                    lastSeenAt: canSeeLastSeen ? target.lastSeenAt : null,
                });
            }
            catch (e) {
                console.error("[socket] presence:get error", e);
            }
        });
        // ─── Conversation rooms ──────────────────────────────────────────────────
        socket.on("conversation:join", (conversationId) => {
            socket.join(conversationId);
        });
        socket.on("conversation:leave", (conversationId) => {
            socket.leave(conversationId);
        });
        // ─── Typing ─────────────────────────────────────────────────────────────
        socket.on("typing:start", async (data) => {
            try {
                const user = await db_1.prisma.user.findUnique({
                    where: { id: data.userId },
                    select: { showTypingIndicator: true },
                });
                if (user?.showTypingIndicator !== false) {
                    socket.to(data.conversationId).emit("typing:start", data);
                }
            }
            catch {
                socket.to(data.conversationId).emit("typing:start", data);
            }
        });
        socket.on("typing:stop", (data) => {
            socket.to(data.conversationId).emit("typing:stop", data);
        });
        // ─── Messages ───────────────────────────────────────────────────────────
        socket.on("message:send", (data) => {
            socket.to(data.conversationId).emit("message:receive", data);
        });
        socket.on("message:edit", (data) => {
            socket.to(data.conversationId).emit("message:edited", data);
        });
        socket.on("message:delete", (data) => {
            socket.to(data.conversationId).emit("message:deleted", data);
        });
        socket.on("message:react", (data) => {
            socket.to(data.conversationId).emit("message:reacted", data);
        });
        // ─── Delivery ────────────────────────────────────────────────────────────
        socket.on("message:delivered", async (data) => {
            try {
                for (const msgId of data.messageIds) {
                    const msg = await db_1.prisma.message.findUnique({ where: { id: msgId } });
                    if (msg) {
                        let delivered = [];
                        try {
                            delivered = JSON.parse(msg.deliveredTo ?? "[]");
                        }
                        catch {
                            delivered = [];
                        }
                        if (!delivered.includes(data.userId)) {
                            delivered.push(data.userId);
                            await db_1.prisma.message.update({
                                where: { id: msgId },
                                data: { deliveredTo: JSON.stringify(delivered) },
                            });
                        }
                    }
                }
                socket.to(data.conversationId).emit("message:delivered", {
                    messageIds: data.messageIds,
                    userId: data.userId,
                });
            }
            catch (e) {
                console.error("[socket] message:delivered error", e);
            }
        });
        // ─── Read receipts ───────────────────────────────────────────────────────
        socket.on("message:read", async (data) => {
            try {
                for (const msgId of (data.messageIds ?? [])) {
                    const msg = await db_1.prisma.message.findUnique({ where: { id: msgId } });
                    if (msg) {
                        let readBy = [];
                        try {
                            readBy = JSON.parse(msg.readBy ?? "[]");
                        }
                        catch {
                            readBy = [];
                        }
                        if (!readBy.includes(data.userId)) {
                            readBy.push(data.userId);
                            await db_1.prisma.message.update({
                                where: { id: msgId },
                                data: { readBy: JSON.stringify(readBy) },
                            });
                        }
                    }
                }
            }
            catch (e) {
                console.error("[socket] message:read persist error", e);
            }
            socket.to(data.conversationId).emit("message:read", data);
        });
        // ─── Notification events from client ─────────────────────────────────────
        socket.on("notification:read", (data) => {
            // Sync across tabs: emit back to all user's devices
            if (data.userId) {
                io.to(data.userId).emit("notification:read", { id: data.id });
            }
        });
        socket.on("notification:read_all", (data) => {
            if (data.userId) {
                io.to(data.userId).emit("notification:read_all");
            }
        });
        // ─── Post real-time updates ──────────────────────────────────────────────
        socket.on("post:join", (postId) => { socket.join(`post:${postId}`); });
        socket.on("post:leave", (postId) => { socket.leave(`post:${postId}`); });
        socket.on("post:reaction", (data) => {
            io.to(`post:${data.postId}`).emit("post:reaction:update", data);
        });
        socket.on("post:comment", (data) => {
            io.to(`post:${data.postId}`).emit("post:comment:new", data);
        });
        // ─── WebRTC Signaling ───────────────────────────────────────────────────
        socket.on("webrtc:offer", (data) => {
            socket.to(data.targetUserId).emit("webrtc:offer", {
                senderId: userId, offer: data.offer,
                conversationId: data.conversationId, callType: data.callType,
            });
        });
        socket.on("webrtc:answer", (data) => {
            socket.to(data.targetUserId).emit("webrtc:answer", { senderId: userId, answer: data.answer });
        });
        socket.on("webrtc:ice-candidate", (data) => {
            socket.to(data.targetUserId).emit("webrtc:ice-candidate", { senderId: userId, candidate: data.candidate });
        });
        socket.on("webrtc:call-end", (data) => {
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
                            await db_1.prisma.user.update({
                                where: { id: userId },
                                data: { lastSeenAt: now },
                            });
                            const user = await db_1.prisma.user.findUnique({
                                where: { id: userId },
                                select: { showOnlineStatus: true },
                            });
                            if (user && user.showOnlineStatus !== "NOBODY") {
                                socket.broadcast.emit("presence:offline", {
                                    userId, lastSeenAt: now.toISOString(),
                                });
                            }
                        }
                        catch (e) {
                            console.error("[socket] disconnect update error", e);
                        }
                    }
                }
                console.log(`[socket] User ${userId} disconnected (${socket.id})`);
            }
        });
    });
}
function emitToUser(io, targetUserId, event, data) {
    io.to(targetUserId).emit(event, data);
}
function isUserOnline(userId) {
    return (activeConnections.get(userId)?.size ?? 0) > 0;
}
function getOnlineUserIds() {
    return Array.from(activeConnections.keys());
}
//# sourceMappingURL=index.js.map