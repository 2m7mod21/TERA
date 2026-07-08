import { getModerationQueue } from "@/server/actions/admin/reports";
import { requireAdminPage } from "@/lib/adminAuth";
import AiModerationClient from "@/components/admin/AiModerationClient";
import { getSettings } from "@/server/actions/admin/settings";

export const metadata = { title: "AI Moderation — TERA Admin" };

export default async function AiModerationPage() {
  await requireAdminPage("aiModeration");
  const [{ items, nextCursor }, settings] = await Promise.all([
    getModerationQueue(),
    getSettings(),
  ]);
  const threshold = (settings["moderation.aiRiskThreshold"] as number) ?? 75;
  return <AiModerationClient initialItems={items} initialCursor={nextCursor} threshold={threshold} />;
}
