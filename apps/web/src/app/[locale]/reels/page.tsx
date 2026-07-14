import { redirect } from "next/navigation";
import { auth } from "@/server/auth/config";
import { getVideoPosts, getSuggestedUsers, getTrendingTopics, getActiveFriends } from "@/server/actions/feed";
import WatchClient from "./WatchClient";

export const dynamic = "force-dynamic";

export default async function ReelsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const [{ posts, nextCursor }, suggested, trending, active] = await Promise.all([
    getVideoPosts(undefined, 10),
    getSuggestedUsers(6),
    getTrendingTopics(6),
    getActiveFriends(6),
  ]);

  return (
    <WatchClient
      initialPosts={posts as any[]}
      initialCursor={nextCursor ?? null}
      user={session.user as any}
      suggested={suggested as any[]}
      trending={trending as any[]}
      active={active as any[]}
    />
  );
}
