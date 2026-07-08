import { getNotifications } from "@/server/actions/notifications";
import { auth } from "@/server/auth/config";
import { redirect } from "next/navigation";
import NotificationsClient from "@/components/NotificationsClient";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const { notifications } = await getNotifications("all", 20);

  return (
    <AppShell>
      <NotificationsClient
        initialNotifications={notifications as any[]}
        currentUserId={session.user.id}
      />
    </AppShell>
  );
}
