"use server";

import { prisma } from "@/lib/db";
import { requireAdmin, writeAuditLog } from "@/lib/adminAuth";
import { revalidatePath } from "next/cache";

// ── Monetization ──────────────────────────────────────────────

export async function getRevenueStats() {
  await requireAdmin("monetization", "read");

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayTips, monthTips, totalTips, activeSubs] = await Promise.all([
    prisma.tip.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: todayStart } } }),
    prisma.tip.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: monthStart } } }),
    prisma.tip.aggregate({ _sum: { amount: true } }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
  ]);

  const subRevMonth = await prisma.subscription.aggregate({
    _sum: { price: true },
    where: { status: "ACTIVE", startDate: { gte: monthStart } },
  });

  return {
    todayRevenue: (todayTips._sum.amount || 0) * 0.05,
    monthRevenue: (monthTips._sum.amount || 0) * 0.05 + (subRevMonth._sum.price || 0) * 0.1,
    totalRevenue: (totalTips._sum.amount || 0) * 0.05,
    activeSubs,
  };
}

export async function getTransactions(cursor?: string) {
  await requireAdmin("monetization", "read");

  const tips = await prisma.tip.findMany({
    include: {
      sender: { include: { profile: true } },
      receiver: { include: { profile: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = tips.length > 25;
  const items = hasMore ? tips.slice(0, 25) : tips;
  return { tips: items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
}

// ── Ads Manager ───────────────────────────────────────────────

export async function getAdCampaigns(status?: string, cursor?: string) {
  await requireAdmin("ads", "read");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const campaigns = await prisma.adCampaign.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 21,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = campaigns.length > 20;
  const items = hasMore ? campaigns.slice(0, 20) : campaigns;
  return { campaigns: items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
}

export async function approveAd(campaignId: string) {
  const ctx = await requireAdmin("ads", "write");
  const old = await prisma.adCampaign.findUnique({ where: { id: campaignId }, select: { status: true } });
  await prisma.adCampaign.update({ where: { id: campaignId }, data: { status: "ACTIVE" } });
  await writeAuditLog(ctx.userId, "APPROVE_AD", {
    targetType: "AdCampaign",
    targetId: campaignId,
    oldValue: { status: old?.status },
    newValue: { status: "ACTIVE" },
  });
  revalidatePath("/admin/ads");
  return { success: true };
}

export async function rejectAd(campaignId: string, reason: string) {
  const ctx = await requireAdmin("ads", "write");
  await prisma.adCampaign.update({
    where: { id: campaignId },
    data: { status: "REJECTED", rejectedReason: reason },
  });
  await writeAuditLog(ctx.userId, "REJECT_AD", {
    targetType: "AdCampaign",
    targetId: campaignId,
    newValue: { status: "REJECTED", reason },
  });
  revalidatePath("/admin/ads");
  return { success: true };
}

export async function pauseAd(campaignId: string) {
  const ctx = await requireAdmin("ads", "write");
  await prisma.adCampaign.update({ where: { id: campaignId }, data: { status: "PAUSED" } });
  await writeAuditLog(ctx.userId, "PAUSE_AD", { targetType: "AdCampaign", targetId: campaignId });
  revalidatePath("/admin/ads");
  return { success: true };
}
