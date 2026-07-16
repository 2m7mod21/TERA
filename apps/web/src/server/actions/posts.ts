"use server";

import { auth } from "@/server/auth/config";
import { PostRepository } from "@/server/repositories/post.repository";
import { postCreateSchema, commentCreateSchema } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { invalidatePattern, CacheKeys } from "@/lib/cache";
import { createNotification } from "./notifications";
import { emitNotification } from "@/server/socket/index";
import { persistMentions } from "./mentions";
import { ModerationService } from "@/services/moderation";
import { logViolationAction } from "./moderation";
import { InteractionLogger } from "@/server/services/feed-engine/interaction-logger";


export async function createPost(formData: any) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const result = postCreateSchema.safeParse(formData);
  if (!result.success) return { success: false, error: result.error.flatten().fieldErrors };

  try {
    const modSetting = await prisma.platformSetting.findUnique({
      where: { key: "moderation_action" }
    });
    const moderationAction = modSetting?.value || "BLOCK";

    let cleanContent = result.data.content;
    let violationResult = null;

    if (result.data.content) {
      const modResult = await ModerationService.checkText(result.data.content);
      if (!modResult.allowed) {
        if (moderationAction === "BLOCK") {
          await logViolationAction(session.user.id, {
            contentType: "POST",
            violationType: modResult.reason || "PROFANITY",
            severity: modResult.severity || "LOW",
            matchedWords: modResult.matchedWords,
          });
          const wordList = modResult.matchedWords?.join(", ") || "prohibited content";
          return {
            success: false,
            error: { global: `Your post contains a prohibited word: "${wordList}". Please remove it before posting.` },
            matchedWords: modResult.matchedWords,
          };
        } else if (moderationAction === "REPLACE") {
          cleanContent = modResult.cleanText;
          result.data.content = cleanContent;
        }
        violationResult = modResult;
      }
    }

    const post = await PostRepository.createPost({ userId: session.user.id, ...result.data });

    if (violationResult) {
      await logViolationAction(session.user.id, {
        contentType: "POST",
        contentId: post.id,
        violationType: violationResult.reason || "PROFANITY",
        severity: violationResult.severity || "LOW",
        matchedWords: violationResult.matchedWords,
      });
    }

    // Persist + notify mentions
    if (result.data.content) {
      await persistMentions(result.data.content, session.user.id, { postId: post.id }, 10);
    }

    await invalidatePattern(CacheKeys.feedPage(session.user.id));
    await invalidatePattern("feed:anonymous:*");
    revalidatePath("/");
    return { success: true, post };
  } catch (error: any) {
    console.error("Create post Action error:", error);
    return { success: false, error: { global: "Failed to create post" } };
  }
}

export async function toggleReaction(data: {
  postId?: string;
  commentId?: string;
  reelId?: string;
  type: string;
}) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    const result = await PostRepository.toggleReaction({ userId: session.user.id, ...data });

    // Only notify on new reaction (not removal)
    if (result.action === "added" || result.action === "updated") {
      // Wire v2 Interaction Logging
      if (data.postId) {
        await InteractionLogger.log({
          userId: session.user.id,
          type: "LIKE",
          targetType: "POST",
          targetId: data.postId,
        });
      } else if (data.reelId) {
        await InteractionLogger.log({
          userId: session.user.id,
          type: "LIKE",
          targetType: "REEL",
          targetId: data.reelId,
        });
      }

      if (data.postId) {
        const post = await prisma.post.findUnique({ where: { id: data.postId }, select: { userId: true } });
        if (post && post.userId !== session.user.id) {
          const n = await createNotification({
            receiverId: post.userId,
            senderId: session.user.id,
            type: "REACTION",
            entityId: data.postId,
            entityType: "POST",
            groupKey: `post:${data.postId}:reactions`,
            metadata: JSON.stringify({ reactionType: data.type }),
          });
          if (n) emitNotification(post.userId, n);
        }
      } else if (data.commentId) {
        const comment = await prisma.comment.findUnique({ where: { id: data.commentId }, select: { userId: true, postId: true } });
        if (comment && comment.userId !== session.user.id) {
          const n = await createNotification({
            receiverId: comment.userId,
            senderId: session.user.id,
            type: "REACTION",
            entityId: data.commentId,
            entityType: data.postId ? "COMMENT_POST" : "COMMENT",
            metadata: JSON.stringify({ reactionType: data.type, relatedPostId: comment.postId }),
          });
          if (n) emitNotification(comment.userId, n);
        }
      }
    }

    if (data.postId) {
      await invalidatePattern(CacheKeys.feedPage(session.user.id));
      await invalidatePattern("feed:anonymous:*");
      revalidatePath("/");
    }
    return { success: true, ...result };
  } catch (error) {
    console.error("Toggle reaction Action error:", error);
    return { success: false, error: "Failed to toggle reaction" };
  }
}

export async function addComment(commentData: any) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const result = commentCreateSchema.safeParse(commentData);
  if (!result.success) return { success: false, error: result.error.flatten().fieldErrors };

  try {
    const modSetting = await prisma.platformSetting.findUnique({
      where: { key: "moderation_action" }
    });
    const moderationAction = modSetting?.value || "BLOCK";

    let cleanContent = result.data.content;
    let violationResult = null;

    if (result.data.content) {
      const modResult = await ModerationService.checkText(result.data.content);
      if (!modResult.allowed) {
        if (moderationAction === "BLOCK") {
          await logViolationAction(session.user.id, {
            contentType: "COMMENT",
            violationType: modResult.reason || "PROFANITY",
            severity: modResult.severity || "LOW",
            matchedWords: modResult.matchedWords,
          });
          const wordList = modResult.matchedWords?.join(", ") || "prohibited content";
          return {
            success: false,
            error: { global: `Your comment contains a prohibited word: "${wordList}". Please remove it.` },
            matchedWords: modResult.matchedWords,
          };
        } else if (moderationAction === "REPLACE") {
          cleanContent = modResult.cleanText;
          result.data.content = cleanContent;
        }
        violationResult = modResult;
      }
    }

    const comment = await PostRepository.addComment({ userId: session.user.id, ...result.data });

    // Wire v2 Interaction Logging
    if (result.data.postId) {
      await InteractionLogger.log({
        userId: session.user.id,
        type: "COMMENT",
        targetType: "POST",
        targetId: result.data.postId,
      });
    }

    if (violationResult) {
      await logViolationAction(session.user.id, {
        contentType: "COMMENT",
        contentId: comment.id,
        violationType: violationResult.reason || "PROFANITY",
        severity: violationResult.severity || "LOW",
        matchedWords: violationResult.matchedWords,
      });
    }

    const { postId, parentId, content } = result.data;

    if (postId) {
      // Notify post owner (comment)
      const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true } });
      if (post && post.userId !== session.user.id) {
        const n = await createNotification({
          receiverId: post.userId,
          senderId: session.user.id,
          type: "COMMENT",
          entityId: postId,
          entityType: "POST",
          groupKey: `post:${postId}:comments`,
          metadata: JSON.stringify({ commentText: content }),
        });
        if (n) emitNotification(post.userId, n);
      }
    }

    if (parentId) {
      // Notify parent comment owner (reply)
      const parent = await prisma.comment.findUnique({ where: { id: parentId }, select: { userId: true, postId: true } });
      if (parent && parent.userId !== session.user.id) {
        const n = await createNotification({
          receiverId: parent.userId,
          senderId: session.user.id,
          type: "REPLY",
          entityId: comment.id,
          entityType: parent.postId ? "COMMENT_POST" : "COMMENT",
          priority: 1,
          metadata: JSON.stringify({ commentText: content, relatedPostId: parent.postId }),
        });
        if (n) emitNotification(parent.userId, n);
      }
    }

    // Persist + notify mentions in comment text
    if (content) {
      await persistMentions(content, session.user.id, { postId: postId ?? undefined, commentId: comment.id }, 5);
    }

    if (postId) {
      await invalidatePattern(CacheKeys.feedPage(session.user.id));
      await invalidatePattern("feed:anonymous:*");
      revalidatePath("/");
    }
    return { success: true, comment };
  } catch (error) {
    console.error("Add comment Action error:", error);
    return { success: false, error: { global: "Failed to post comment" } };
  }
}

export async function votePoll(optionId: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    const vote = await PostRepository.votePoll(optionId, session.user.id);
    revalidatePath("/");
    return { success: true, vote };
  } catch (error: any) {
    console.error("Vote poll Action error:", error);
    return { success: false, error: error.message || "Failed to vote in poll" };
  }
}

export async function savePost(postId: string, collectionId?: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    await PostRepository.savePost(session.user.id, postId, collectionId);

    // Notify post owner of save
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true } });
    if (post && post.userId !== session.user.id) {
      const n = await createNotification({
        receiverId: post.userId,
        senderId: session.user.id,
        type: "SAVE",
        entityId: postId,
        entityType: "POST",
      });
      if (n) emitNotification(post.userId, n);
    }

    revalidatePath("/bookmarks");
    return { success: true };
  } catch (error) {
    console.error("Save post Action error:", error);
    return { success: false, error: "Failed to save post" };
  }
}

export async function unsavePost(postId: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    await PostRepository.unsavePost(session.user.id, postId);
    revalidatePath("/bookmarks");
    return { success: true };
  } catch (error) {
    console.error("Unsave post Action error:", error);
    return { success: false, error: "Failed to unsave post" };
  }
}

export async function createCollection(name: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    const col = await PostRepository.createCollection(session.user.id, name);
    revalidatePath("/bookmarks");
    return { success: true, collection: col };
  } catch (error) {
    console.error("Create collection Action error:", error);
    return { success: false, error: "Failed to create collection" };
  }
}

export async function viewPost(postId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  try {
    await prisma.post.update({
      where: { id: postId },
      data: { viewCount: { increment: 1 } },
    });
    if (userId) {
      await prisma.postView.upsert({
        where: { postId_userId: { postId, userId } },
        update: {},
        create: { postId, userId },
      });
      // Wire v2 Interaction Logging
      await InteractionLogger.log({
        userId,
        type: "VIEW",
        targetType: "POST",
        targetId: postId,
      });
    }
    return { success: true };
  } catch (error) {
    console.error("View post action error:", error);
    return { success: false };
  }
}

export async function sharePost(postId: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    const updated = await prisma.post.update({
      where: { id: postId },
      data: { shareCount: { increment: 1 } },
    });

    await prisma.post.create({
      data: {
        userId: session.user.id,
        type: "TEXT",
        content: `shared a post`,
        parentPostId: postId,
        visibility: "PUBLIC",
      },
    });

    // Wire v2 Interaction Logging
    await InteractionLogger.log({
      userId: session.user.id,
      type: "SHARE",
      targetType: "POST",
      targetId: postId,
    });

    // Notify original post owner
    const original = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true } });
    if (original && original.userId !== session.user.id) {
      const n = await createNotification({
        receiverId: original.userId,
        senderId: session.user.id,
        type: "SHARE",
        entityId: postId,
        entityType: "POST",
      });
      if (n) emitNotification(original.userId, n);
    }

    revalidatePath("/");
    return { success: true, shareCount: updated.shareCount };
  } catch (error) {
    console.error("Share post action error:", error);
    return { success: false, error: "Failed to share post" };
  }
}

export async function hidePost(postId: string, reason?: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    await prisma.feedHide.upsert({
      where: { userId_postId: { userId: session.user.id, postId } },
      update: { reason },
      create: { userId: session.user.id, postId, reason },
    });
    // Wire v2 Interaction Logging
    await InteractionLogger.log({
      userId: session.user.id,
      type: "HIDE",
      targetType: "POST",
      targetId: postId,
    });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Hide post action error:", error);
    return { success: false, error: "Failed to hide post" };
  }
}

export async function reportPost(postId: string, reason: string, details?: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    const r = await prisma.report.create({
      data: {
        reporterId: session.user.id,
        contentType: "POST",
        contentId: postId,
        postId,
        reason,
        details: details || null,
        status: "PENDING",
      },
    });
    // Wire v2 Interaction Logging
    await InteractionLogger.log({
      userId: session.user.id,
      type: "REPORT",
      targetType: "POST",
      targetId: postId,
    });
    return { success: true, report: r };
  } catch (error) {
    console.error("Report post action error:", error);
    return { success: false, error: "Failed to submit report" };
  }
}

export async function editPost(postId: string, content: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.userId !== session.user.id) {
      return { success: false, error: "Unauthorized or post not found" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.post.update({ where: { id: postId }, data: { content, isEdited: true } });
      await tx.postHashtag.deleteMany({ where: { postId } });
      const hashtags = content.match(/#(\w+)/g);
      if (hashtags) {
        for (const rawTag of hashtags) {
          const tagName = rawTag.slice(1).toLowerCase();
          const tag = await tx.hashtag.upsert({
            where: { name: tagName },
            update: {},
            create: { name: tagName },
          });
          await tx.postHashtag.create({ data: { postId, hashtagId: tag.id } });
        }
      }
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Edit post action error:", error);
    return { success: false, error: "Failed to edit post" };
  }
}

export async function deletePost(postId: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.userId !== session.user.id) {
      return { success: false, error: "Unauthorized or post not found" };
    }
    await prisma.post.delete({ where: { id: postId } });
    await invalidatePattern(CacheKeys.feedPage(session.user.id));
    await invalidatePattern("feed:anonymous:*");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Delete post action error:", error);
    return { success: false, error: "Failed to delete post" };
  }
}

export async function editComment(commentId: string, content: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.userId !== session.user.id) {
      return { success: false, error: "Unauthorized or comment not found" };
    }
    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: { content, isEdited: true },
      include: { user: { include: { profile: true } } },
    });
    revalidatePath("/");
    return { success: true, comment: updated };
  } catch (error) {
    console.error("Edit comment error:", error);
    return { success: false, error: "Failed to edit comment" };
  }
}

export async function deleteComment(commentId: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { replies: true },
    });
    if (!comment || comment.userId !== session.user.id) {
      return { success: false, error: "Unauthorized or comment not found" };
    }
    if (comment.replies.length > 0) {
      const updated = await prisma.comment.update({
        where: { id: commentId },
        data: { isDeleted: true, content: "This comment was deleted" },
        include: { user: { include: { profile: true } } },
      });
      revalidatePath("/");
      return { success: true, comment: updated, action: "soft-deleted" };
    } else {
      await prisma.comment.delete({ where: { id: commentId } });
      revalidatePath("/");
      return { success: true, action: "deleted" };
    }
  } catch (error) {
    console.error("Delete comment error:", error);
    return { success: false, error: "Failed to delete comment" };
  }
}

export async function pinComment(commentId: string, isPinned: boolean) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { post: true },
    });
    if (!comment || !comment.post) return { success: false, error: "Comment or post not found" };
    if (comment.post.userId !== session.user.id) {
      return { success: false, error: "Only the post author can pin comments" };
    }
    if (isPinned) {
      await prisma.comment.updateMany({
        where: { postId: comment.postId, isPinned: true },
        data: { isPinned: false },
      });
    }
    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: { isPinned },
      include: { user: { include: { profile: true } } },
    });
    revalidatePath("/");
    return { success: true, comment: updated };
  } catch (error) {
    console.error("Pin comment error:", error);
    return { success: false, error: "Failed to pin comment" };
  }
}

export async function getPostById(postId: string) {
  const session = await auth();
  const viewerId = session?.user?.id ?? null;

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: { include: { profile: true } },
        reactions: true,
        comments: {
          where: { parentId: null },
          take: 3,
          orderBy: { createdAt: "desc" },
          include: {
            user: { include: { profile: true } },
            reactions: true,
            replies: {
              include: { user: { include: { profile: true } }, reactions: true },
              orderBy: { createdAt: "asc" },
            },
          },
        },
        poll: { include: { options: { include: { votes: true } } } },
        _count: { select: { comments: true, reactions: true } },
        shares: { select: { userId: true, content: true } },
        parentPost: {
          include: {
            user: { include: { profile: true } },
            reactions: true,
            poll: { include: { options: { include: { votes: true } } } },
            _count: { select: { comments: true, reactions: true } },
          }
        },
      },
    });

    if (!post) return { success: false, notFound: true };

    // Visibility check
    if (post.visibility === "PRIVATE") {
      if (post.userId !== viewerId) return { success: false, isPrivate: true };
    }
    if (post.visibility === "FRIENDS") {
      if (!viewerId) return { success: false, isPrivate: true };
      if (post.userId !== viewerId) {
        const follow = await prisma.follow.findUnique({
          where: { followerId_followeeId: { followerId: viewerId, followeeId: post.userId } },
        });
        if (!follow) return { success: false, isPrivate: true };
      }
    }

    return { success: true, post };
  } catch (error) {
    console.error("getPostById error:", error);
    return { success: false, notFound: true };
  }
}

export async function getComments(postId: string, sortBy: "relevant" | "newest") {
  try {
    const comments = await prisma.comment.findMany({
      where: { postId, parentId: null },
      include: {
        user: { include: { profile: true } },
        reactions: true,
        replies: {
          include: { user: { include: { profile: true } }, reactions: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy:
        sortBy === "relevant"
          ? [{ isPinned: "desc" }, { reactions: { _count: "desc" } }, { createdAt: "desc" }]
          : [{ isPinned: "desc" }, { createdAt: "desc" }],
    });
    return { success: true, comments };
  } catch (error) {
    console.error("Get comments error:", error);
    return { success: false, error: "Failed to fetch comments" };
  }
}

export async function getPostReactors(postId: string, type?: string, cursor?: string | null, limit = 10) {
  const session = await auth();
  const viewerId = session?.user?.id ?? null;

  try {
    const whereClause: any = { postId };
    if (type && type !== "ALL") {
      whereClause.type = type;
    }

    const reactions = await prisma.reaction.findMany({
      where: whereClause,
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          include: {
            profile: true,
            followers: viewerId ? { where: { followerId: viewerId } } : false,
          },
        },
      },
    });

    let nextCursor: string | null = null;
    let hasMore = false;
    if (reactions.length > limit) {
      hasMore = true;
      const nextItem = reactions.pop();
      nextCursor = nextItem?.id ?? null;
    }

    const reactors = reactions.map((r) => {
      const isFollowing = viewerId ? (r.user.followers && r.user.followers.length > 0) : false;
      return {
        id: r.user.id,
        name: r.user.profile?.displayName ?? "User",
        username: r.user.profile?.username ?? "username",
        avatar: r.user.profile?.avatarUrl,
        isFollowing,
        reactionType: r.type,
      };
    });

    return { success: true, reactors, nextCursor, hasMore };
  } catch (error) {
    console.error("getPostReactors error:", error);
    return { success: false, error: "Failed to load reactors" };
  }
}

export async function repostPost(postId: string, content?: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    // Check if simple repost already exists
    if (!content) {
      const existing = await prisma.post.findFirst({
        where: {
          userId: session.user.id,
          parentPostId: postId,
          type: "REPOST",
          content: null,
        },
      });
      if (existing) return { success: false, error: "Already reposted" };
    }

    const post = await prisma.post.create({
      data: {
        userId: session.user.id,
        parentPostId: postId,
        type: "REPOST",
        content: content || null,
        visibility: "PUBLIC",
      },
    });

    await prisma.post.update({
      where: { id: postId },
      data: { shareCount: { increment: 1 } },
    });

    const originalPost = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (originalPost && originalPost.userId !== session.user.id) {
      const n = await createNotification({
        receiverId: originalPost.userId,
        senderId: session.user.id,
        type: "REACTION",
        entityId: post.id,
        entityType: "POST",
        metadata: JSON.stringify({ action: content ? "quoted" : "reposted", repostId: post.id }),
      });
      if (n) emitNotification(originalPost.userId, n);
    }

    revalidatePath("/");
    return { success: true, post };
  } catch (error) {
    console.error("repostPost error:", error);
    return { success: false, error: "Failed to repost" };
  }
}

export async function unrepostPost(postId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const repost = await prisma.post.findFirst({
      where: {
        userId: session.user.id,
        parentPostId: postId,
        type: "REPOST",
        content: null,
      },
    });

    if (!repost) return { success: false, error: "Not reposted yet" };

    await prisma.post.delete({
      where: { id: repost.id },
    });

    await prisma.post.update({
      where: { id: postId },
      data: { shareCount: { decrement: 1 } },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("unrepostPost error:", error);
    return { success: false, error: "Failed to unrepost" };
  }
}
