import { getMassNotifications } from "@/server/actions/admin/notifications";
import { requireAdminPage } from "@/lib/adminAuth";
import NotificationsClient from "@/components/admin/NotificationsClient";

export const metadata = { title: "Notification Management — TERA Admin" };

export default async function NotificationsPage() {
  await requireAdminPage("notifications");
  const { items, nextCursor } = await getMassNotifications();
  return <NotificationsClient initialItems={items} initialCursor={nextCursor} />;
}
