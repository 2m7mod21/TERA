import { getJoinedGroups, getExploreGroups } from "@/server/actions/communities";
import { auth } from "@/server/auth/config";
import { redirect } from "next/navigation";
import GroupsClient from "@/components/GroupsClient";

export default async function GroupsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const [joined, explore] = await Promise.all([
    getJoinedGroups(),
    getExploreGroups(),
  ]);

  return (
    <GroupsClient
      joinedGroups={joined}
      exploreGroups={explore}
    />
  );
}
