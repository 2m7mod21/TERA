"use server";

import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db";

export interface SearchParams {
  query: string;
  sortBy?: "relevant" | "recent" | "popular";
  timeframe?: "all" | "today" | "week" | "month";
  mediaType?: "all" | "video" | "image" | "poll";
  author?: "all" | "friends";
}

export async function searchAll(queryOrParams: string | SearchParams) {
  const session = await auth();
  const currentUserId = session?.user?.id;

  let queryText = "";
  let sortBy: "relevant" | "recent" | "popular" = "relevant";
  let timeframe: "all" | "today" | "week" | "month" = "all";
  let mediaType: "all" | "video" | "image" | "poll" = "all";
  let author: "all" | "friends" = "all";

  if (typeof queryOrParams === "string") {
    queryText = queryOrParams.trim();
  } else if (queryOrParams && typeof queryOrParams === "object") {
    queryText = (queryOrParams.query || "").trim();
    sortBy = queryOrParams.sortBy || "relevant";
    timeframe = queryOrParams.timeframe || "all";
    mediaType = queryOrParams.mediaType || "all";
    author = queryOrParams.author || "all";
  }

  if (!queryText) {
    return {
      users: [],
      posts: [],
      reels: [],
      groups: [],
      pages: [],
      hashtags: [],
      comments: [],
      stories: [],
    };
  }

  try {
    const q = queryText.toLowerCase();

    // 1. Get user connections (who the searching user follows)
    let followingIds: string[] = [];
    if (currentUserId) {
      const myFollows = await prisma.follow.findMany({
        where: { followerId: currentUserId },
        select: { followeeId: true },
      });
      followingIds = myFollows.map((f) => f.followeeId);
    }

    // 2. Compute date constraints based on timeframe filter
    let dateLimit: Date | undefined;
    if (timeframe === "today") {
      dateLimit = new Date(Date.now() - 24 * 60 * 60 * 1000);
    } else if (timeframe === "week") {
      dateLimit = new Date(Date.now() - 7 * 24 * 60 * 60 * 1050);
    } else if (timeframe === "month") {
      dateLimit = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    // 3. Setup post query filters
    const postWhereClause: any = {
      visibility: { in: ["PUBLIC", "FRIENDS"] },
    };

    if (dateLimit) {
      postWhereClause.createdAt = { gte: dateLimit };
    }

    // Media type filters
    if (mediaType === "video") {
      postWhereClause.type = "VIDEO";
    } else if (mediaType === "image") {
      postWhereClause.type = { in: ["IMAGE", "CAROUSEL"] };
    } else if (mediaType === "poll") {
      postWhereClause.poll = { isNot: null };
    }

    // Author filters
    if (author === "friends" && currentUserId) {
      postWhereClause.userId = { in: followingIds };
    }

    // Combine with search query matches
    postWhereClause.OR = [
      { content: { contains: queryText } },
      { location: { contains: queryText } },
      { feeling: { contains: queryText } },
      { hashtags: { some: { hashtag: { name: { contains: queryText.replace(/^#/, "") } } } } },
    ];

    // 4. Parallel database querying
    const [dbUsers, dbPosts, dbReels, dbGroups, dbPages, dbHashtags, dbComments, dbStories] = await Promise.all([
      // Users
      prisma.user.findMany({
        where: {
          isBanned: false,
          OR: [
            { email: { contains: queryText } },
            { profile: { displayName: { contains: queryText } } },
            { profile: { username: { contains: queryText } } },
            { profile: { bio: { contains: queryText } } },
          ],
        },
        include: {
          profile: true,
          _count: { select: { posts: true, followers: true } },
        },
        take: 30,
      }),

      // Posts
      prisma.post.findMany({
        where: postWhereClause,
        include: {
          user: { include: { profile: true } },
          reactions: true,
          comments: { take: 3, include: { user: { include: { profile: true } } } },
          poll: { include: { options: { include: { votes: true } } } },
          _count: { select: { comments: true } },
        },
        take: 50,
      }),

      // Reels model (direct table match)
      prisma.reel.findMany({
        where: {
          OR: [
            { caption: { contains: queryText } },
            { user: { profile: { displayName: { contains: queryText } } } },
            { user: { profile: { username: { contains: queryText } } } },
          ],
          ...(commentWhereTime(dateLimit)),
        },
        include: {
          user: { include: { profile: true } },
          reactions: true,
          _count: { select: { comments: true } },
        },
        take: 20,
      }),

      // Groups
      prisma.group.findMany({
        where: {
          OR: [
            { name: { contains: queryText } },
            { description: { contains: queryText } },
          ],
        },
        include: {
          _count: { select: { members: true } },
        },
        take: 20,
      }),

      // Pages
      prisma.page.findMany({
        where: {
          OR: [
            { name: { contains: queryText } },
            { category: { contains: queryText } },
            { description: { contains: queryText } },
          ],
        },
        include: {
          _count: { select: { followers: true } },
        },
        take: 20,
      }),

      // Hashtags
      prisma.hashtag.findMany({
        where: { name: { contains: queryText.replace(/^#/, "").toLowerCase() } },
        include: {
          _count: { select: { posts: true } },
        },
        take: 15,
      }),

      // Comments
      prisma.comment.findMany({
        where: {
          content: { contains: queryText },
          ...(commentWhereTime(dateLimit)),
        },
        include: {
          user: { include: { profile: true } },
          reactions: true,
        },
        take: 20,
      }),

      // Stories
      prisma.story.findMany({
        where: {
          textContent: { contains: queryText },
          expiresAt: { gte: new Date() },
          archivedAt: null,
        },
        include: {
          user: { include: { profile: true } },
          reactions: true,
        },
        take: 15,
      }),
    ]);

    // 5. Intelligent Ranking Algorithm (Personalized and Weighted)
    const now = Date.now();

    // Map & score users
    const scoredUsers = dbUsers.map((u: any) => {
      let score = 0;
      const uDisp = (u.profile?.displayName || "").toLowerCase();
      const uName = (u.profile?.username || "").toLowerCase();

      // Text relevance
      if (uDisp === q || uName === q) score += 120;
      else if (uDisp.startsWith(q) || uName.startsWith(q)) score += 60;
      else score += 20;

      // Relationship boost
      if (followingIds.includes(u.id)) score += 60;

      // Popularity
      score += (u._count?.followers || 0) * 1.5;

      return { item: u, score };
    });

    // Map & score posts
    const scoredPosts = dbPosts.map((p: any) => {
      let score = 0;
      const contentText = (p.content || "").toLowerCase();

      // Text relevance
      if (contentText.includes(q)) score += 30;
      if (contentText.startsWith(q)) score += 20;

      // Engagement score
      const likes = p.reactions?.length || 0;
      const comments = p._count?.comments || p.comments?.length || 0;
      const views = p.viewCount || 0;
      const shares = p.shareCount || 0;
      score += likes * 2 + comments * 5 + shares * 10 + views * 0.5;

      // Relationship
      if (followingIds.includes(p.userId)) score += 70;

      // Freshness decay (lose 0.5 points per hour)
      const ageHours = (now - p.createdAt.getTime()) / (1000 * 60 * 60);
      score -= ageHours * 0.5;

      return { item: p, score };
    });

    // Map & score Reels
    const scoredReels = dbReels.map((r: any) => {
      let score = 0;
      const capText = (r.caption || "").toLowerCase();
      if (capText.includes(q)) score += 30;

      const likes = r.reactions?.length || 0;
      const comments = r._count?.comments || 0;
      score += likes * 3 + comments * 5;

      if (followingIds.includes(r.userId)) score += 70;

      const ageHours = (now - r.createdAt.getTime()) / (1000 * 60 * 60);
      score -= ageHours * 0.5;

      return { item: r, score };
    });

    // Map & score Groups
    const scoredGroups = dbGroups.map((g: any) => {
      let score = 0;
      const nameText = g.name.toLowerCase();
      if (nameText === q) score += 100;
      else if (nameText.includes(q)) score += 40;

      score += (g._count?.members || 0) * 1;
      return { item: g, score };
    });

    // Map & score Pages
    const scoredPages = dbPages.map((pg: any) => {
      let score = 0;
      const nameText = pg.name.toLowerCase();
      if (nameText === q) score += 100;
      else if (nameText.includes(q)) score += 40;

      score += (pg._count?.followers || 0) * 1.2;
      return { item: pg, score };
    });

    // Sort by filter
    const sortAndExtract = (scoredList: Array<{ item: any; score: number }>) => {
      if (sortBy === "recent") {
        return scoredList
          .map((x) => x.item)
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      } else if (sortBy === "popular") {
        return scoredList
          .sort((a, b) => {
            const countA = a.item.viewCount || a.item._count?.followers || a.item._count?.members || a.item.reactions?.length || 0;
            const countB = b.item.viewCount || b.item._count?.followers || b.item._count?.members || b.item.reactions?.length || 0;
            return countB - countA;
          })
          .map((x) => x.item);
      } else {
        // sortBy: "relevant" (default weighted)
        return scoredList.sort((a, b) => b.score - a.score).map((x) => x.item);
      }
    };

    return {
      users: sortAndExtract(scoredUsers),
      posts: sortAndExtract(scoredPosts),
      reels: sortAndExtract(scoredReels),
      groups: sortAndExtract(scoredGroups),
      pages: sortAndExtract(scoredPages),
      hashtags: dbHashtags.sort((a: any, b: any) => (b._count?.posts || 0) - (a._count?.posts || 0)),
      comments: dbComments.map((c: any) => ({ ...c, score: (c.reactions?.length || 0) })),
      stories: dbStories,
    };
  } catch (error) {
    console.error("searchAll intelligent search error:", error);
    return {
      users: [],
      posts: [],
      reels: [],
      groups: [],
      pages: [],
      hashtags: [],
      comments: [],
      stories: [],
    };
  }
}

function commentWhereTime(dateLimit?: Date) {
  return dateLimit ? { createdAt: { gte: dateLimit } } : {};
}

export async function getSearchSuggestions(query: string) {
  const q = query.trim();
  if (!q) return { users: [], hashtags: [], groups: [], queries: [] };

  try {
    const [users, hashtags, groups, posts] = await Promise.all([
      prisma.user.findMany({
        where: {
          isBanned: false,
          OR: [
            { profile: { displayName: { contains: q } } },
            { profile: { username: { contains: q } } },
          ],
        },
        include: { profile: true },
        take: 5,
      }),
      prisma.hashtag.findMany({
        where: { name: { contains: q.replace(/^#/, "").toLowerCase() } },
        take: 5,
      }),
      prisma.group.findMany({
        where: { name: { contains: q } },
        take: 5,
      }),
      prisma.post.findMany({
        where: { content: { contains: q }, visibility: "PUBLIC" },
        select: { content: true },
        take: 5,
      }),
    ]);

    const queries = posts
      .map((p) => p.content?.slice(0, 40).trim())
      .filter((v, i, self) => !!v && self.indexOf(v) === i);

    return {
      users: users.map((u) => u.profile),
      hashtags: hashtags.map((h) => h.name),
      groups: groups.map((g) => ({ id: g.id, name: g.name })),
      queries,
    };
  } catch {
    return { users: [], hashtags: [], groups: [], queries: [] };
  }
}

export async function getTrendingHashtags() {
  try {
    const tags = await prisma.hashtag.findMany({
      include: { _count: { select: { posts: true } } },
      orderBy: { posts: { _count: "desc" } },
      take: 10,
    });
    return tags.map((t: any) => ({ id: t.id, name: t.name, count: t._count.posts }));
  } catch {
    return [];
  }
}

export async function getTrendingPosts() {
  try {
    return prisma.post.findMany({
      where: { visibility: "PUBLIC" },
      include: {
        user: { include: { profile: true } },
        reactions: true,
        _count: { select: { comments: true } },
      },
      orderBy: { viewCount: "desc" },
      take: 6,
    });
  } catch {
    return [];
  }
}

export async function getHashtagPosts(hashtag: string) {
  try {
    const tag = await prisma.hashtag.findFirst({
      where: { name: hashtag.replace(/^#/, "").toLowerCase() },
      include: {
        posts: {
          include: {
            post: {
              include: {
                user: { include: { profile: true } },
                reactions: true,
                _count: { select: { comments: true } },
              },
            },
          },
          take: 20,
          orderBy: { post: { createdAt: "desc" } },
        },
      },
    });
    return tag?.posts.map((p) => p.post) ?? [];
  } catch {
    return [];
  }
}
