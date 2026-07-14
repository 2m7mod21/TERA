import { getDashboardStats, getNeedsAttentionItems, getActivityChart } from "@/server/actions/admin/dashboard";
import { requireAdminPage } from "@/lib/adminAuth";
import DashboardClient from "@/components/admin/DashboardClient";

export const metadata = { title: "Dashboard — TERA Admin" };

export default async function AdminDashboardPage() {
  await requireAdminPage("dashboard");
  const [stats, attentionItems, chartData] = await Promise.all([
    getDashboardStats(),
    getNeedsAttentionItems(),
    getActivityChart(),
  ]);
  return <DashboardClient stats={stats} attentionItems={attentionItems} chartData={chartData} />;
}
