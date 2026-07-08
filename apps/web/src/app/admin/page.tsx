import {
  getDashboardStats,
  getAdminUsers,
  getModerationQueue,
  getAnalyticsChartData,
} from "@/server/actions/admin";
import { auth } from "@/server/auth/config";
import { redirect } from "next/navigation";
import AdminClient from "@/components/AdminClient";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect("/");

  const [stats, users, reports, chartData] = await Promise.all([
    getDashboardStats(),
    getAdminUsers(),
    getModerationQueue(),
    getAnalyticsChartData(),
  ]);

  return (
    <AdminClient
      stats={stats}
      users={users}
      reports={reports}
      chartData={chartData}
    />
  );
}
