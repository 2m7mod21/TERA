import { getSuggestedUsers } from "@/server/actions/social";
import { getTrendingHashtags } from "@/server/actions/search";
import { auth } from "@/server/auth/config";
import { redirect } from "next/navigation";
import ExploreClient from "@/components/ExploreClient";
import AppShell from "@/components/AppShell";

export default async function ExplorePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  const [suggested, trendingHashtags] = await Promise.all([
    getSuggestedUsers(),
    getTrendingHashtags(),
  ]);
  return (
    <AppShell>
      <ExploreClient
        suggested={suggested as any[]}
        currentUserId={session.user.id}
        trendingHashtags={trendingHashtags as any[]}
      />
    </AppShell>
  );
}
