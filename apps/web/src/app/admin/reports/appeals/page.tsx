import { getAppeals } from "@/server/actions/admin/reports";
import { requireAdminPage } from "@/lib/adminAuth";
import AppealsClient from "@/components/admin/AppealsClient";

export const metadata = { title: "Appeals — TERA Admin" };

export default async function AppealsPage() {
  await requireAdminPage("reports");
  const { appeals, nextCursor } = await getAppeals({ status: "PENDING" });
  return <AppealsClient initialAppeals={appeals} initialCursor={nextCursor} />;
}
