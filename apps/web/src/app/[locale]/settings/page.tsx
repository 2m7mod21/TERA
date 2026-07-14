import { getSettings } from "@/server/actions/settings";
import { auth } from "@/server/auth/config";
import { redirect } from "next/navigation";
import SettingsClient from "@/components/SettingsClient";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const settings = await getSettings();

  return <SettingsClient initialSettings={settings} />;
}
