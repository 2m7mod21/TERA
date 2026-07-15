"use server";

import { prisma } from "@/lib/db";
import { requireAdmin, writeAuditLog } from "@/lib/adminAuth";
import { revalidatePath } from "next/cache";

// Default weights seed data
export const DEFAULT_WEIGHT_ENTRIES = [
  { componentKey: "affinity",                value: 0.30, description: "Weight for viewer→author affinity score",               minValue: 0, maxValue: 1 },
  { componentKey: "engagement",              value: 0.25, description: "Weight for predicted engagement probability",            minValue: 0, maxValue: 1 },
  { componentKey: "contentMatch",            value: 0.20, description: "Weight for topic/interest match score",                  minValue: 0, maxValue: 1 },
  { componentKey: "recency",                 value: 0.15, description: "Weight for freshness/recency decay score",               minValue: 0, maxValue: 1 },
  { componentKey: "coldStart",               value: 0.10, description: "Boost given to cold-start creator candidates",           minValue: 0, maxValue: 1 },
  { componentKey: "halfLifeHours",           value: 48,   description: "Recency half-life in hours (lower = fresher bias)",      minValue: 1, maxValue: 720 },
  { componentKey: "maxPerAuthor",            value: 2,    description: "Max posts per author per page in diversity pass",        minValue: 1, maxValue: 10 },
  { componentKey: "explorationSlotPct",      value: 0.10, description: "Fraction of feed positions reserved for exploration",   minValue: 0, maxValue: 0.5 },
  { componentKey: "trendingGuaranteedEvery", value: 8,    description: "Insert a trending slot every N positions (0=disabled)", minValue: 0, maxValue: 50 },
  { componentKey: "coldStartGuaranteedEvery",value: 10,   description: "Insert a cold-start slot every N positions (0=disabled)",minValue: 0, maxValue: 50 },
];

/**
 * Fetch all weight entries for a profile.
 */
export async function getFeedWeightProfile(profileName = "default") {
  const db = prisma as any;
  const configs = await db.feedWeightConfig.findMany({
    where: { profileName },
    orderBy: { componentKey: "asc" },
  });

  // Map database field weightValue to value for frontend compatibility
  const mappedConfigs = configs.map((c: any) => ({
    ...c,
    value: c.weightValue,
  }));

  return { profileName, configs: mappedConfigs };
}

/**
 * List all profile names.
 */
export async function listWeightProfiles() {
  const db = prisma as any;
  const profiles = await db.feedWeightConfig.findMany({
    select: { profileName: true },
    distinct: ["profileName"],
  });
  return profiles.map((p: any) => p.profileName as string);
}

/**
 * Save (upsert) weight entries for a profile. Writes an audit log per changed key.
 */
export async function saveFeedWeightProfile(
  profileName: string,
  weights: Record<string, number>
) {
  const ctx = await requireAdmin("feedWeights", "write");
  const db = prisma as any;

  for (const [componentKey, value] of Object.entries(weights)) {
    const existing = await db.feedWeightConfig.findFirst({
      where: { profileName, componentKey },
    });

    if (existing) {
      const oldValue = existing.weightValue;
      if (Math.abs(oldValue - value) < 0.000001) continue; // no change

      await db.feedWeightConfig.update({
        where: { id: existing.id },
        data: { weightValue: value, updatedAt: new Date() },
      });

      await db.feedWeightAuditLog.create({
        data: {
          profileName,
          componentKey,
          oldValue,
          newValue: value,
          adminId: ctx.userId,
        },
      });
    } else {
      await db.feedWeightConfig.create({
        data: {
          profileName,
          componentKey,
          weightValue: value,
        },
      });
    }
  }

  await writeAuditLog(ctx.userId, "FEED_WEIGHTS_SAVED", {
    targetType: "FeedWeightConfig",
    targetId: profileName,
    newValue: weights,
  });

  revalidatePath("/admin/feed-algorithm");
  return { success: true };
}

/**
 * Reset a profile to default weights.
 */
export async function resetFeedWeightProfile(profileName: string) {
  const ctx = await requireAdmin("feedWeights", "write");
  const db = prisma as any;

  for (const entry of DEFAULT_WEIGHT_ENTRIES) {
    const existing = await db.feedWeightConfig.findFirst({
      where: { profileName, componentKey: entry.componentKey },
    });

    if (existing) {
      await db.feedWeightConfig.update({
        where: { id: existing.id },
        data: { weightValue: entry.value, updatedAt: new Date() },
      });
      await db.feedWeightAuditLog.create({
        data: {
          profileName,
          componentKey: entry.componentKey,
          oldValue: existing.weightValue,
          newValue: entry.value,
          adminId: ctx.userId,
        },
      });
    } else {
      await db.feedWeightConfig.create({
        data: {
          profileName,
          componentKey: entry.componentKey,
          weightValue: entry.value,
        },
      });
    }
  }

  await writeAuditLog(ctx.userId, "FEED_WEIGHTS_RESET", {
    targetType: "FeedWeightConfig",
    targetId: profileName,
  });

  revalidatePath("/admin/feed-algorithm");
  return { success: true };
}

/**
 * Create a new named weight profile by copying the default.
 */
export async function createWeightProfile(name: string) {
  const ctx = await requireAdmin("feedWeights", "write");
  const db = prisma as any;

  const existing = await db.feedWeightConfig.findFirst({ where: { profileName: name } });
  if (existing) return { success: false, error: "Profile already exists" };

  for (const entry of DEFAULT_WEIGHT_ENTRIES) {
    await db.feedWeightConfig.create({
      data: {
        profileName: name,
        componentKey: entry.componentKey,
        weightValue: entry.value,
      },
    });
  }

  await writeAuditLog(ctx.userId, "FEED_WEIGHT_PROFILE_CREATED", {
    targetType: "FeedWeightConfig",
    targetId: name,
  });

  revalidatePath("/admin/feed-algorithm");
  return { success: true };
}

/**
 * Get recent audit log entries across all profiles.
 */
export async function getFeedWeightAuditLog(profileName?: string, limit = 50) {
  await requireAdmin("feedWeights", "read");
  const db = prisma as any;

  const logs = await db.feedWeightAuditLog.findMany({
    where: profileName ? { profileName } : {},
    orderBy: { changedAt: "desc" },
    take: limit,
  });

  const adminIds = Array.from(new Set(logs.map((l: any) => l.adminId))) as string[];
  const admins = await prisma.user.findMany({
    where: { id: { in: adminIds } },
    select: { id: true, profile: { select: { displayName: true } } },
  });

  const adminMap = new Map(admins.map((a) => [a.id, a]));

  const mappedLogs = logs.map((log: any) => ({
    ...log,
    createdAt: log.changedAt,
    admin: adminMap.get(log.adminId),
  }));

  return mappedLogs;
}
