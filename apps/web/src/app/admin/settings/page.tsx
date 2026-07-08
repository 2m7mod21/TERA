import { getSettings } from "@/server/actions/admin/settings";
import { requireAdminPage } from "@/lib/adminAuth";
import SettingsClient from "@/components/admin/SettingsClient";

export const metadata = { title: "Platform Settings — TERA Admin" };

export default async function SettingsPage() {
  await requireAdminPage("settings");
  const settings = await getSettings();
  return <SettingsClient settings={settings} />;
}
