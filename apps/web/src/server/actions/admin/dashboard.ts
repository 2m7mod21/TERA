"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";

/** Refresh and cache platform stats into PlatformStat table */
export async function refreshPlatformStats() {
  await requireAdmin("dashboard", "read");

  const [
    totalUsers,
    totalPosts,
    totalComments,
    totalReactions,
    totalMessages,
    pendingReports,
    tipsSum,
    subsSum,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.comment.count(),
    prisma.reaction.count(),
    prisma.message.count(),
    prisma.report.count({ where: { status: "PENDING" } }),
    prisma.tip.aggregate({ _sum: { amount: true } }),
    prisma.subscription.aggregate({ _sum: { price: true } }),
  ]);

  const revenue = (tipsSum._sum.amount || 0) * 0.05 + (subsSum._sum.price || 0) * 0.1;

  const stats = [
    { key: "total_users", value: totalUsers },
    { key: "total_posts", value: totalPosts },
    { key: "total_comments", value: totalComments },
    { key: "total_reactions", value: totalReactions },
    { key: "total_messages", value: totalMessages },
    { key: "pending_reports", value: pendingReports },
    { key: "platform_revenue", value: revenue },
  ];

  await Promise.all(
    stats.map((s) =>
      prisma.platformStat.upsert({
        where: { key: s.key },
        create: { key: s.key, value: s.value },
        update: { value: s.value },
      })
    )
  );

  return stats;
}

/** Get cached dashboard stats (fast - no live COUNT) */
export async function getDashboardStats() {
  await requireAdmin("dashboard", "read");

  const cached = await prisma.platformStat.findMany();
  const map = Object.fromEntries(cached.map((s) => [s.key, s.value]));

  // If cache is empty, compute on the fly and store
  if (cached.length === 0) {
    const stats = await refreshPlatformStats();
    return Object.fromEntries(stats.map((s) => [s.key, s.value]));
  }

  return map;
}

/** Get the 5 highest priority pending reports for "Needs Attention" panel */
export async function getNeedsAttentionItems() {
  await requireAdmin("dashboard", "read");

  const reports = await prisma.report.findMany({
    where: { status: "PENDING" },
    include: {
      reporter: { include: { profile: true } },
      post: { include: { user: { include: { profile: true } } } },
    },
    orderBy: { priority: "desc" },
    take: 5,
  });

  return reports;
}

/** 30-day activity chart data */
export async function getActivityChart() {
  await requireAdmin("dashboard", "read");

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [signupEvents, postEvents] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where: { type: "SESSION_START", createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.analyticsEvent.findMany({
      where: { type: "POST_CREATED", createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  const chartMap: Record<string, { date: string; signups: number; posts: number }> = {};

  const formatDay = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  signupEvents.forEach((e) => {
    const key = formatDay(new Date(e.createdAt));
    if (!chartMap[key]) chartMap[key] = { date: key, signups: 0, posts: 0 };
    chartMap[key].signups++;
  });

  postEvents.forEach((e) => {
    const key = formatDay(new Date(e.createdAt));
    if (!chartMap[key]) chartMap[key] = { date: key, signups: 0, posts: 0 };
    chartMap[key].posts++;
  });

  return Object.values(chartMap).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}
