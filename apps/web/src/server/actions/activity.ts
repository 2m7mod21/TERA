"use server";

import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getActivityLog(type?: string, limit = 50) {
  const session = await auth();
  if (!session?.user?.id) return [];

  try {
    return prisma.analyticsEvent.findMany({
      where: {
        userId: session.user.id,
        ...(type && type !== "ALL" ? { type } : {}),
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("getActivityLog error:", error);
    return [];
  }
}

export async function logUserActivity(
  type: string,
  entityId?: string,
  entityType?: string,
  meta: Record<string, any> = {}
) {
  const session = await auth();
  if (!session?.user?.id) return null;

  try {
    return prisma.analyticsEvent.create({
      data: {
        userId: session.user.id,
        type,
        entityId: entityId || null,
        entityType: entityType || null,
        meta: JSON.stringify(meta),
      },
    });
  } catch (error) {
    console.error("logUserActivity error:", error);
    return null;
  }
}

export async function clearActivityLog() {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await prisma.analyticsEvent.deleteMany({
      where: { userId: session.user.id },
    });
    revalidatePath("/activity");
    return { success: true };
  } catch (error) {
    console.error("clearActivityLog error:", error);
    return { success: false, error: "Failed to clear logs" };
  }
}
