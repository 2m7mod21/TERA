"use server";

import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getAdminUsers() {
  const session = await auth();
  if (!session?.user?.isAdmin) throw new Error("Unauthorized");

  try {
    return prisma.user.findMany({
      include: { profile: true },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("getAdminUsers error:", error);
    return [];
  }
}

export async function toggleAdminStatus(userId: string) {
  const session = await auth();
  if (!session?.user?.isAdmin) return { success: false, error: "Unauthorized" };

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, error: "User not found" };

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isAdmin: !user.isAdmin },
    });

    revalidatePath("/admin");
    return { success: true, user: updated };
  } catch (error) {
    console.error("toggleAdminStatus error:", error);
    return { success: false, error: "Failed to update admin status" };
  }
}

export async function toggleVerificationBadge(userId: string) {
  const session = await auth();
  if (!session?.user?.isAdmin) return { success: false, error: "Unauthorized" };

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, error: "User not found" };

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { verifiedBadge: !user.verifiedBadge },
    });

    revalidatePath("/admin");
    return { success: true, user: updated };
  } catch (error) {
    console.error("toggleVerificationBadge error:", error);
    return { success: false, error: "Failed to update verification badge" };
  }
}

export async function getDashboardStats() {
  const session = await auth();
  if (!session?.user?.isAdmin) throw new Error("Unauthorized");

  try {
    const [
      totalUsers,
      totalPosts,
      totalComments,
      totalReactions,
      tipsSum,
      subsSum,
      pendingReports,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.comment.count(),
      prisma.reaction.count(),
      prisma.tip.aggregate({ _sum: { amount: true } }),
      prisma.subscription.aggregate({ _sum: { price: true } }),
      prisma.report.count({ where: { status: "PENDING" } }),
    ]);

    const totalTips = tipsSum._sum.amount || 0;
    const totalSubscriptions = subsSum._sum.price || 0;
    const totalPlatformRevenue = totalTips * 0.05 + totalSubscriptions * 0.10;

    return {
      totalUsers,
      totalPosts,
      totalComments,
      totalReactions,
      totalPlatformRevenue,
      pendingReports,
    };
  } catch (error) {
    console.error("getDashboardStats error:", error);
    throw error;
  }
}

export async function getModerationQueue() {
  const session = await auth();
  if (!session?.user?.isAdmin) return [];

  try {
    return prisma.report.findMany({
      where: { status: "PENDING" },
      include: {
        reporter: { include: { profile: true } },
        post: {
          include: {
            user: { include: { profile: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("getModerationQueue error:", error);
    return [];
  }
}

export async function resolveReport(id: string, decision: "RESOLVED" | "IGNORED") {
  const session = await auth();
  if (!session?.user?.isAdmin) return { success: false, error: "Unauthorized" };

  try {
    await prisma.report.update({
      where: { id },
      data: { status: decision },
    });
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("resolveReport error:", error);
    return { success: false, error: "Failed to update report status" };
  }
}

export async function blockOrWarnUser(userId: string, action: "SUSPEND" | "BAN" | "UNBAN" | "UNSUSPEND") {
  const session = await auth();
  if (!session?.user?.isAdmin) return { success: false, error: "Unauthorized" };

  try {
    const data: Record<string, boolean> = {};
    if (action === "SUSPEND") data.isSuspended = true;
    if (action === "UNSUSPEND") data.isSuspended = false;
    if (action === "BAN") data.isBanned = true;
    if (action === "UNBAN") data.isBanned = false;

    await prisma.user.update({
      where: { id: userId },
      data,
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("blockOrWarnUser error:", error);
    return { success: false, error: "Failed to update user security properties" };
  }
}

export async function getAnalyticsChartData() {
  const session = await auth();
  if (!session?.user?.isAdmin) return [];

  try {
    // Return mock analytics or query logs inside past 7 days
    const events = await prisma.analyticsEvent.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      select: { type: true, createdAt: true },
    });

    // Bucket by day
    const chartMap: Record<string, any> = {};
    events.forEach((ev) => {
      const dateStr = new Date(ev.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      if (!chartMap[dateStr]) {
        chartMap[dateStr] = { date: dateStr, signups: 0, posts: 0, actions: 0 };
      }
      if (ev.type === "SESSION_START") chartMap[dateStr].signups++;
      else if (ev.type === "POST_CREATED") chartMap[dateStr].posts++;
      else chartMap[dateStr].actions++;
    });

    return Object.values(chartMap);
  } catch {
    return [];
  }
}
