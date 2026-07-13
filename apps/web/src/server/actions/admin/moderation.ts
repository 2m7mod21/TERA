"use server";

import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { ModerationService } from "@/services/moderation";

// Helper to assert admin privilege
async function assertAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function getBlockedWords(params: {
  search?: string;
  category?: string;
  severity?: string;
  language?: string;
  page?: number;
  limit?: number;
}) {
  try {
    await assertAdmin();
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.search) {
      where.word = { contains: params.search };
    }
    if (params.category) {
      where.category = params.category;
    }
    if (params.severity) {
      where.severity = params.severity;
    }
    if (params.language) {
      where.language = params.language;
    }

    const [words, total] = await Promise.all([
      prisma.blockedWord.findMany({
        where,
        orderBy: { word: "asc" },
        skip,
        take: limit,
      }),
      prisma.blockedWord.count({ where }),
    ]);

    return {
      success: true,
      words,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to fetch blocked words" };
  }
}

export async function addBlockedWord(data: {
  word: string;
  language: string;
  category: string;
  severity: string;
}) {
  try {
    await assertAdmin();

    const normalizedWord = data.word.trim().toLowerCase();
    if (!normalizedWord) {
      return { success: false, error: "Word cannot be empty" };
    }

    const existing = await prisma.blockedWord.findUnique({
      where: { word: normalizedWord },
    });
    if (existing) {
      return { success: false, error: "Word is already blocked" };
    }

    const blockedWord = await prisma.blockedWord.create({
      data: {
        word: normalizedWord,
        language: data.language,
        category: data.category,
        severity: data.severity,
      },
    });

    ModerationService.reloadCache();
    revalidatePath("/admin/moderation");
    return { success: true, blockedWord };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to add blocked word" };
  }
}

export async function updateBlockedWord(
  id: string,
  data: {
    word?: string;
    language?: string;
    category?: string;
    severity?: string;
    isActive?: boolean;
  }
) {
  try {
    await assertAdmin();

    const updateData: any = {};
    if (data.word !== undefined) {
      updateData.word = data.word.trim().toLowerCase();
    }
    if (data.language !== undefined) updateData.language = data.language;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.severity !== undefined) updateData.severity = data.severity;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const blockedWord = await prisma.blockedWord.update({
      where: { id },
      data: updateData,
    });

    ModerationService.reloadCache();
    revalidatePath("/admin/moderation");
    return { success: true, blockedWord };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update blocked word" };
  }
}

export async function deleteBlockedWord(id: string) {
  try {
    await assertAdmin();

    await prisma.blockedWord.delete({
      where: { id },
    });

    ModerationService.reloadCache();
    revalidatePath("/admin/moderation");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to delete blocked word" };
  }
}

export async function getViolations(params: {
  search?: string;
  violationType?: string;
  severity?: string;
  page?: number;
  limit?: number;
}) {
  try {
    await assertAdmin();
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.search) {
      where.user = {
        OR: [
          { email: { contains: params.search } },
          { profile: { displayName: { contains: params.search } } },
          { profile: { username: { contains: params.search } } },
        ],
      };
    }
    if (params.violationType) {
      where.violationType = params.violationType;
    }
    if (params.severity) {
      where.severity = params.severity;
    }

    const [violations, total] = await Promise.all([
      prisma.userViolation.findMany({
        where,
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.userViolation.count({ where }),
    ]);

    return {
      success: true,
      violations,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to fetch violations" };
  }
}

export async function getViolationStats() {
  try {
    await assertAdmin();

    const [totalViolations, activeViolations, typeCounts, severityCounts] = await Promise.all([
      prisma.userViolation.count(),
      prisma.userViolation.count({ where: { isActive: true } }),
      prisma.userViolation.groupBy({
        by: ["violationType"],
        _count: true,
      }),
      prisma.userViolation.groupBy({
        by: ["severity"],
        _count: true,
      }),
    ]);

    return {
      success: true,
      stats: {
        totalViolations,
        activeViolations,
        typeCounts: typeCounts.map((t) => ({ type: t.violationType, count: t._count })),
        severityCounts: severityCounts.map((s) => ({ severity: s.severity, count: s._count })),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to get violation statistics" };
  }
}

export async function getModerationSettings() {
  try {
    await assertAdmin();

    const [actionSetting] = await Promise.all([
      prisma.platformSetting.findUnique({
        where: { key: "moderation_action" },
      }),
    ]);

    return {
      success: true,
      settings: {
        moderation_action: actionSetting?.value || "BLOCK",
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to get moderation settings" };
  }
}

export async function updateModerationSettings(settings: { moderation_action: string }) {
  try {
    await assertAdmin();

    await prisma.platformSetting.upsert({
      where: { key: "moderation_action" },
      update: { value: settings.moderation_action },
      create: { key: "moderation_action", value: settings.moderation_action },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update moderation settings" };
  }
}
