import { getFailedLogins, getBlockedIPs, getActiveSessions } from "@/server/actions/admin/security";
import { requireAdminPage } from "@/lib/adminAuth";
import SecurityClient from "@/components/admin/SecurityClient";

export const metadata = { title: "Security Center — TERA Admin" };

export default async function SecurityPage() {
  await requireAdminPage("security");
  const [{ items: failedLogins }, blockedIPs, sessions] = await Promise.all([
    getFailedLogins(),
    getBlockedIPs(),
    getActiveSessions(),
  ]);
  return <SecurityClient failedLogins={failedLogins} blockedIPs={blockedIPs} activeSessions={sessions} />;
}
