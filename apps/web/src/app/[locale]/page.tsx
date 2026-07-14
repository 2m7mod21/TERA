import { auth } from "@/server/auth/config";
import { redirect } from "next/navigation";
import { getFeedPosts, getSuggestedUsers, getTrendingTopics, getActiveFriends } from "@/server/actions/feed";
import { getStories } from "@/server/actions/stories";
import { getUnreadCount } from "@/server/actions/notifications";
import HomeFeed from "@/components/HomeFeed";

export const dynamic = "force-dynamic";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/auth/login`);

  const [{ posts, nextCursor }, suggested, trending, active, stories, notifCount] = await Promise.all([
    getFeedPosts(),
    getSuggestedUsers(6),
    getTrendingTopics(6),
    getActiveFriends(6),
    getStories(),
    getUnreadCount(),
  ]);

  return (
    <HomeFeed
      initialPosts={posts as any[]}
      initialCursor={nextCursor ?? null}
      user={session.user as any}
      suggested={suggested as any[]}
      trending={trending as any[]}
      active={active as any[]}
      initialStories={stories as any[]}
      notifCount={notifCount}
    />
  );
}
