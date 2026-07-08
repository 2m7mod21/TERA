"use server";

import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function sendTip(receiverId: string, amount: number) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  if (session.user.id === receiverId) {
    return { success: false, error: "You cannot tip yourself" };
  }

  if (amount <= 0) {
    return { success: false, error: "Amount must be greater than zero" };
  }

  try {
    const tip = await prisma.tip.create({
      data: {
        senderId: session.user.id,
        receiverId,
        amount,
      },
    });

    // Send a notification to creator
    await prisma.notification.create({
      data: {
        receiverId,
        senderId: session.user.id,
        type: "REACTION", // Custom notification code, tip works under interactions
        entityId: tip.id,
      },
    });

    return { success: true, tip };
  } catch (error) {
    console.error("Send tip Action error:", error);
    return { success: false, error: "Failed to process tip payment" };
  }
}

export async function subscribeToCreator(creatorId: string, price: number, tier = "BASIC") {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  if (session.user.id === creatorId) {
    return { success: false, error: "You cannot subscribe to yourself" };
  }

  try {
    const activeSub = await prisma.subscription.findFirst({
      where: {
        subscriberId: session.user.id,
        creatorId,
        status: "ACTIVE",
        endDate: { gt: new Date() },
      },
    });

    if (activeSub) {
      return { success: false, error: "You already have an active subscription to this creator" };
    }

    const sub = await prisma.subscription.create({
      data: {
        subscriberId: session.user.id,
        creatorId,
        tier,
        price,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 Day cycle
      },
    });

    // Send a notification to creator
    await prisma.notification.create({
      data: {
        receiverId: creatorId,
        senderId: session.user.id,
        type: "FOLLOW",
        entityId: sub.id,
      },
    });

    revalidatePath(`/${session.user.username}`);
    return { success: true, subscription: sub };
  } catch (error) {
    console.error("Subscribe to creator Action error:", error);
    return { success: false, error: "Failed to process subscription" };
  }
}

export async function getCreatorDashboardStats() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  try {
    const totalTips = await prisma.tip.aggregate({
      where: { receiverId: session.user.id },
      _sum: { amount: true },
    });

    const activeSubs = await prisma.subscription.findMany({
      where: {
        creatorId: session.user.id,
        status: "ACTIVE",
        endDate: { gt: new Date() },
      },
      include: {
        subscriber: { include: { profile: true } },
      },
    });

    const tipsSum = totalTips._sum.amount || 0;
    const subsSum = activeSubs.reduce((acc: number, sub: any) => acc + sub.price, 0);
    const grossEarnings = tipsSum + subsSum;
    const netEarnings = grossEarnings * 0.90; // Creator keeps 90% of earnings

    return {
      tipsSum,
      subscribersCount: activeSubs.length,
      grossEarnings,
      netEarnings,
      activeSubscribers: activeSubs.map((s: any) => ({
        id: s.id,
        username: s.subscriber.profile?.username || "user",
        displayName: s.subscriber.profile?.displayName || "Subscriber",
        avatarUrl: s.subscriber.profile?.avatarUrl,
        startDate: s.startDate,
        endDate: s.endDate,
      })),
    };
  } catch (error) {
    console.error("Get creator stats error:", error);
    throw error;
  }
}
