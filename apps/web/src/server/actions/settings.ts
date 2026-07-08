"use server";

import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

export async function getSettings() {
  const session = await auth();
  if (!session?.user?.id) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
        showOnlineStatus: true,
        showLastSeen: true,
        showReadReceipts: true,
        showTypingIndicator: true,
        profile: {
          select: {
            displayName: true,
            username: true,
            privacyLevel: true,
          },
        },
        appearanceSetting: true,
        notificationPrefs: true,
      },
    });

    return user;
  } catch (error) {
    console.error("getSettings error:", error);
    return null;
  }
}

export async function updateAccountSettings(data: {
  displayName?: string;
  email?: string;
  password?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const updates: Record<string, any> = {};

    if (data.email) {
      if (data.email !== session.user.email) {
        const existing = await prisma.user.findUnique({ where: { email: data.email } });
        if (existing) return { success: false, error: "Email already taken" };
        updates.email = data.email;
      }
    }

    if (data.password) {
      updates.passwordHash = await bcrypt.hash(data.password, 12);
    }

    if (Object.keys(updates).length > 0) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: updates,
      });
    }

    if (data.displayName) {
      await prisma.profile.update({
        where: { userId: session.user.id },
        data: { displayName: data.displayName },
      });
    }

    revalidatePath("/settings");
    return { success: true };
  } catch (error: any) {
    console.error("updateAccountSettings error:", error);
    return { success: false, error: error.message || "Failed to update profile settings" };
  }
}

export async function updatePrivacySettings(data: { privacyLevel: "PUBLIC" | "FRIENDS" | "PRIVATE" }) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await prisma.profile.update({
      where: { userId: session.user.id },
      data: { privacyLevel: data.privacyLevel },
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("updatePrivacySettings error:", error);
    return { success: false, error: "Failed to update privacy settings" };
  }
}

export async function updateMessagingPrivacySettings(data: {
  showOnlineStatus?: "EVERYONE" | "FRIENDS" | "NOBODY";
  showLastSeen?: "EVERYONE" | "FRIENDS" | "NOBODY";
  showReadReceipts?: boolean;
  showTypingIndicator?: boolean;
}) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data,
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("updateMessagingPrivacySettings error:", error);
    return { success: false, error: "Failed to update messaging privacy settings" };
  }
}

export async function updateSecuritySettings(data: { twoFactorEnabled: boolean }) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorEnabled: data.twoFactorEnabled },
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("updateSecuritySettings error:", error);
    return { success: false, error: "Failed to update security settings" };
  }
}

export async function updateAppearanceSettings(data: {
  theme?: string;
  fontSize?: string;
  reducedMotion?: boolean;
}) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await (prisma as any).appearanceSetting.upsert({
      where: { userId: session.user.id },
      update: data,
      create: {
        userId: session.user.id,
        theme: data.theme ?? "SYSTEM",
        fontSize: data.fontSize ?? "MEDIUM",
        reducedMotion: data.reducedMotion ?? false,
      },
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("updateAppearanceSettings error:", error);
    return { success: false, error: "Failed to update appearance settings" };
  }
}

export async function updateNotificationPreference(
  category: "LIKES" | "COMMENTS" | "FOLLOWS" | "MESSAGES" | "MENTIONS" | "GROUP" | "REMINDERS",
  settings: { push?: boolean; email?: boolean }
) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await (prisma as any).notificationPreference.upsert({
      where: {
        userId_category: {
          userId: session.user.id,
          category,
        },
      },
      update: settings,
      create: {
        userId: session.user.id,
        category,
        push: settings.push ?? true,
        email: settings.email ?? true,
      },
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("updateNotificationPreference error:", error);
    return { success: false, error: "Failed to update notification preferences" };
  }
}
