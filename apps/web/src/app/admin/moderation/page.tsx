import { requireAdminPage } from "@/lib/adminAuth";
import ModerationClient from "@/components/admin/ModerationClient";

export const metadata = { title: "Word Moderation — TERA Admin" };

export default async function ModerationPage() {
  await requireAdminPage("reports");
  return <ModerationClient />;
}
