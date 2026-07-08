import { getProfileByUsername } from "@/server/actions/social";
import { notFound } from "next/navigation";
import ProfilePageClient from "@/components/ProfilePage";

export default async function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const data = await getProfileByUsername(username);
  if (!data) notFound();
  return <ProfilePageClient data={data as any} />;
}
