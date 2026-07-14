import { getSystemMetrics } from "@/server/actions/admin/system";
import { requireAdminPage } from "@/lib/adminAuth";
import SystemClient from "@/components/admin/SystemClient";

export const metadata = { title: "System Monitor — TERA Admin" };

export default async function SystemPage() {
  await requireAdminPage("systemMonitor");
  const metrics = await getSystemMetrics();
  return <SystemClient metrics={metrics} />;
}
