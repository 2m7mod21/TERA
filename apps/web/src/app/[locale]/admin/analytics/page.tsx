import { getAnalytics, getAdminUserGrowth } from "@/server/actions/admin/analytics";
import { requireAdminPage } from "@/lib/adminAuth";
import AnalyticsClient from "@/components/admin/AnalyticsClient";

export const metadata = { title: "Analytics — TERA Admin" };

export default async function AnalyticsPage() {
  await requireAdminPage("analytics");
  const [data, growth] = await Promise.all([getAnalytics(30), getAdminUserGrowth()]);
  return <AnalyticsClient data={data} growth={growth} />;
}
