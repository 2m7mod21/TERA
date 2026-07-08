"use server";

import { prisma } from "@/lib/db";
import { requireAdmin, writeAuditLog } from "@/lib/adminAuth";
import { revalidatePath } from "next/cache";

const DEFAULT_SETTINGS: Record<string, string> = {
  "site.name": JSON.stringify("TERA"),
  "site.logo": JSON.stringify(""),
  "site.accentColor": JSON.stringify("#6366f1"),
  "register.emailEnabled": JSON.stringify(true),
  "register.phoneEnabled": JSON.stringify(true),
  "register.newSignupsEnabled": JSON.stringify(true),
  "content.maxPostLength": JSON.stringify(2000),
  "content.maxImageSizeMb": JSON.stringify(10),
  "content.maxVideoSizeMb": JSON.stringify(100),
  "content.maxHashtagsPerPost": JSON.stringify(20),
  "moderation.aiRiskThreshold": JSON.stringify(75),
};

export async function getSettings() {
  await requireAdmin("settings", "read");

  const rows = await prisma.platformSetting.findMany();
  const map: Record<string, unknown> = {};

  // Seed defaults if not already set
  for (const [key, defaultVal] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = rows.find((r) => r.key === key);
    if (!existing) {
      await prisma.platformSetting.create({ data: { key, value: defaultVal } });
      map[key] = JSON.parse(defaultVal);
    } else {
      try {
        map[key] = JSON.parse(existing.value);
      } catch {
        map[key] = existing.value;
      }
    }
  }

  // Also include any custom rows
  for (const row of rows) {
    if (!(row.key in map)) {
      try {
        map[row.key] = JSON.parse(row.value);
      } catch {
        map[row.key] = row.value;
      }
    }
  }

  return map;
}

export async function updateSetting(key: string, value: unknown) {
  const ctx = await requireAdmin("settings", "write");

  const old = await prisma.platformSetting.findUnique({ where: { key } });

  await prisma.platformSetting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(value), updatedBy: ctx.userId },
    update: { value: JSON.stringify(value), updatedBy: ctx.userId },
  });

  await writeAuditLog(ctx.userId, "UPDATE_SETTING", {
    targetType: "Setting",
    targetId: key,
    oldValue: old?.value ? JSON.parse(old.value) : null,
    newValue: value,
  });

  revalidatePath("/admin/settings");
  return { success: true };
}
