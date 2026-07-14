import { getReports, getReportsStats } from "@/server/actions/admin/reports";
import { requireAdminPage } from "@/lib/adminAuth";
import ReportsClient from "@/components/admin/ReportsClient";

export const metadata = { title: "Reports & Moderation — TERA Admin" };

export default async function ReportsPage() {
  await requireAdminPage("reports");
  const [{ reports, nextCursor }, stats] = await Promise.all([
    getReports({ status: "PENDING" }),
    getReportsStats(),
  ]);
  return <ReportsClient initialReports={reports} initialCursor={nextCursor} initialStats={stats} />;
}
