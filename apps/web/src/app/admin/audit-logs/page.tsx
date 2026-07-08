import { getAuditLogs } from "@/server/actions/admin/auditLog";
import { requireAdminPage } from "@/lib/adminAuth";
import AuditLogsClient from "@/components/admin/AuditLogsClient";

export const metadata = { title: "Audit Logs — TERA Admin" };

export default async function AuditLogsPage() {
  await requireAdminPage("auditLogs");
  const { logs, nextCursor } = await getAuditLogs();
  return <AuditLogsClient initialLogs={logs} initialCursor={nextCursor} />;
}
