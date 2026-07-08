import { getSupportTickets } from "@/server/actions/admin/notifications";
import { requireAdminPage } from "@/lib/adminAuth";
import SupportClient from "@/components/admin/SupportClient";

export const metadata = { title: "Support Center — TERA Admin" };

export default async function SupportPage() {
  await requireAdminPage("support");
  const { tickets, nextCursor } = await getSupportTickets();
  return <SupportClient initialTickets={tickets} initialCursor={nextCursor} />;
}
