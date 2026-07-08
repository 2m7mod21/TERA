import { getContent } from "@/server/actions/admin/content";
import { requireAdminPage } from "@/lib/adminAuth";
import ContentClient from "@/components/admin/ContentClient";

export const metadata = { title: "Content Management — TERA Admin" };

export default async function ContentPage() {
  await requireAdminPage("content");
  const { posts, nextCursor } = await getContent();
  return <ContentClient initialPosts={posts} initialCursor={nextCursor} />;
}
