import { notFound } from "next/navigation";
import { Metadata } from "next";
import { auth } from "@/server/auth/config";
import { getPostById } from "@/server/actions/posts";
import { getFeedPosts, getSuggestedUsers, getTrendingTopics, getActiveFriends } from "@/server/actions/feed";
import PostPageClient from "./PostPageClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ postId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { postId } = await params;
  const result = await getPostById(postId);
  if (!result.success || !result.post) {
    return { title: "Post Not Found — TERA" };
  }
  const post = result.post as any;
  const author = post.user?.profile?.displayName ?? "TERA";
  const excerpt = (post.content ?? "").slice(0, 160);
  const mediaUrls: string[] = (() => { try { return JSON.parse(post.mediaUrls || "[]"); } catch { return []; } })();
  const image = mediaUrls[0] ?? null;

  return {
    title: `${author} on TERA${excerpt ? `: "${excerpt}"` : ""}`,
    description: excerpt || `See ${author}'s post on TERA`,
    openGraph: {
      title: `${author} on TERA`,
      description: excerpt || `See ${author}'s post on TERA`,
      ...(image ? { images: [{ url: image }] } : {}),
      type: "article",
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: `${author} on TERA`,
      description: excerpt,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { postId } = await params;
  const session = await auth();

  const result = await getPostById(postId);

  if (result.notFound) notFound();

  if (result.isPrivate) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔒</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-100 mb-2">This post is private</h1>
          <p className="text-zinc-500 text-sm">
            Only certain people can see this post. Follow the author or ask them to change the visibility.
          </p>
        </div>
      </div>
    );
  }

  const [{ posts: feedPosts, nextCursor }, suggested, trending, active] = await Promise.all([
    getFeedPosts(),
    getSuggestedUsers(6),
    getTrendingTopics(6),
    getActiveFriends(6),
  ]);

  return (
    <PostPageClient
      post={result.post as any}
      feedPosts={feedPosts as any[]}
      feedCursor={nextCursor ?? null}
      user={session?.user as any}
      suggested={suggested as any[]}
      trending={trending as any[]}
      active={active as any[]}
    />
  );
}
