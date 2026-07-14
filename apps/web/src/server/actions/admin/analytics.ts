"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";

export async function getAnalytics(range: 7 | 14 | 30 = 30) {
  await requireAdmin("analytics", "read");

  const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000);

  const events = await prisma.analyticsEvent.findMany({
    where: { createdAt: { gte: since } },
    select: { type: true, createdAt: true, entityType: true },
  });

  const dayMap: Record<string, { date: string; signups: number; posts: number; likes: number; comments: number }> = {};
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  for (const ev of events) {
    const key = fmt(new Date(ev.createdAt));
    if (!dayMap[key]) dayMap[key] = { date: key, signups: 0, posts: 0, likes: 0, comments: 0 };
    if (ev.type === "SESSION_START") dayMap[key].signups++;
    else if (ev.type === "POST_CREATED") dayMap[key].posts++;
    else if (ev.type === "POST_LIKED") dayMap[key].likes++;
    else if (ev.type === "POST_COMMENTED") dayMap[key].comments++;
  }

  // Top posts by engagement
  const topPosts = await prisma.post.findMany({
    where: { createdAt: { gte: since } },
    include: {
      user: { include: { profile: true } },
      _count: { select: { reactions: true, comments: true } },
    },
    orderBy: { reactions: { _count: "desc" } },
    take: 10,
  });

  // Geographic breakdown from profile locations
  const locations = await prisma.profile.groupBy({
    by: ["location"],
    _count: { location: true },
    orderBy: { _count: { location: "desc" } },
    take: 10,
    where: { location: { not: null } },
  });

  const timeline = Object.values(dayMap).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return { timeline, topPosts, locations };
}

export async function getAdminUserGrowth() {
  await requireAdmin("analytics", "read");

  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const prev30 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const [currentPeriod, prevPeriod] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: last30 } } }),
    prisma.user.count({ where: { createdAt: { gte: prev30, lt: last30 } } }),
  ]);

  const trend = prevPeriod > 0 ? ((currentPeriod - prevPeriod) / prevPeriod) * 100 : 0;
  return { currentPeriod, prevPeriod, trend };
}
