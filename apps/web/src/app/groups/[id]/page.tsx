import { getGroupDetails, getJoinRequests } from "@/server/actions/communities";
import { auth } from "@/server/auth/config";
import { redirect } from "next/navigation";
import GroupDetailsClient from "@/components/GroupDetailsClient";

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const [group, requests] = await Promise.all([
    getGroupDetails(id),
    getJoinRequests(id),
  ]);

  if (!group) redirect("/groups");

  return (
    <GroupDetailsClient
      group={group}
      currentUserId={session.user.id}
      pendingJoinRequests={requests}
    />
  );
}
