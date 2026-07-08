import { getCollections, getSavedPosts } from "@/server/actions/saved";
import { auth } from "@/server/auth/config";
import { redirect } from "next/navigation";
import SavedClient from "@/components/SavedClient";

export default async function SavedPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const [collections, posts] = await Promise.all([
    getCollections(),
    getSavedPosts(),
  ]);

  return (
    <SavedClient
      initialCollections={collections}
      initialPosts={posts}
      currentUserId={session.user.id}
    />
  );
}
