"use server";

import { prisma } from "@/lib/db";
import { requireAdmin, writeAuditLog } from "@/lib/adminAuth";
import { revalidatePath } from "next/cache";

// ── Mass Notifications ────────────────────────────────────────

export async function getMassNotifications(cursor?: string) {
  await requireAdmin("notifications", "read");

  const items = await prisma.massNotification.findMany({
    orderBy: { createdAt: "desc" },
    take: 21,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > 20;
  const entries = hasMore ? items.slice(0, 20) : items;
  return { items: entries, nextCursor: hasMore ? entries[entries.length - 1].id : null };
}

export async function sendMassNotification(data: {
  title: string;
  body: string;
  target: "ALL" | "VERIFIED" | "INACTIVE_30";
  scheduledAt?: string;
}) {
  const ctx = await requireAdmin("notifications", "write");

  const notif = await prisma.massNotification.create({
    data: {
      title: data.title,
      body: data.body,
      target: data.target,
      sentBy: ctx.userId,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      status: data.scheduledAt ? "SCHEDULED" : "SCHEDULED",
    },
  });

  // If not scheduled, trigger via JobQueue
  if (!data.scheduledAt) {
    await prisma.jobQueue.create({
      data: {
        type: "SEND_MASS_NOTIFICATION",
        payload: JSON.stringify({ notificationId: notif.id }),
        status: "PENDING",
      },
    });
  }

  await writeAuditLog(ctx.userId, "SEND_MASS_NOTIFICATION", {
    targetType: "MassNotification",
    targetId: notif.id,
    newValue: { title: data.title, target: data.target },
  });

  revalidatePath("/admin/notifications");
  return { success: true, id: notif.id };
}

// ── Support Center ────────────────────────────────────────────

export async function getSupportTickets(
  status?: "OPEN" | "IN_PROGRESS" | "RESOLVED",
  cursor?: string
) {
  await requireAdmin("support", "read");

  const tickets = await prisma.supportTicket.findMany({
    where: status ? { status } : {},
    include: {
      user: { include: { profile: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 21,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = tickets.length > 20;
  const items = hasMore ? tickets.slice(0, 20) : tickets;
  return { tickets: items, nextCursor: hasMore ? items[items.length - 1].id : null };
}

export async function getTicketMessages(ticketId: string) {
  await requireAdmin("support", "read");
  return prisma.ticketMessage.findMany({
    where: { ticketId },
    orderBy: { createdAt: "asc" },
  });
}

export async function replyToTicket(ticketId: string, content: string) {
  const ctx = await requireAdmin("support", "write");

  await prisma.ticketMessage.create({
    data: { ticketId, senderId: ctx.userId, content, isAdmin: true },
  });

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: "IN_PROGRESS" },
  });

  revalidatePath("/admin/support");
  return { success: true };
}

export async function resolveTicket(ticketId: string) {
  const ctx = await requireAdmin("support", "write");
  await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: "RESOLVED" } });
  await writeAuditLog(ctx.userId, "RESOLVE_TICKET", { targetType: "SupportTicket", targetId: ticketId });
  revalidatePath("/admin/support");
  return { success: true };
}

export async function assignTicket(ticketId: string, adminUserId: string) {
  const ctx = await requireAdmin("support", "write");
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { assignedTo: adminUserId, status: "IN_PROGRESS" },
  });
  await writeAuditLog(ctx.userId, "ASSIGN_TICKET", {
    targetType: "SupportTicket",
    targetId: ticketId,
    newValue: { assignedTo: adminUserId },
  });
  revalidatePath("/admin/support");
  return { success: true };
}
