import { getActivityLog } from "@/server/actions/activity";
import { auth } from "@/server/auth/config";
import { redirect } from "next/navigation";
import ActivityLogClient from "@/components/ActivityLogClient";

export default async function ActivityLogPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const events = await getActivityLog();

  return <ActivityLogClient initialEvents={events} />;
}
