import { prisma } from "@/lib/db";

export class PostRepository {
  static async createPost(data: {
    userId: string;
    type: string;
    content?: string;
    mediaUrls?: string[];
    visibility?: string;
    groupId?: string | null;
    pageId?: string | null;
    pollQuestion?: string;
    pollOptions?: string[];
    location?: string;
    feeling?: string;
  }) {
    const mediaField = data.mediaUrls ? JSON.stringify(data.mediaUrls) : "[]";
    
    return prisma.$transaction(async (tx: any) => {
      const post = await tx.post.create({
        data: {
          userId: data.userId,
          type: data.type,
          content: data.content || null,
          mediaUrls: mediaField,
          visibility: data.visibility || "PUBLIC",
          groupId: data.groupId || null,
          pageId: data.pageId || null,
          location: data.location || null,
          feeling: data.feeling || null,
        },
      });

      // Parse and link hashtags from content
      if (data.content) {
        const hashtags = data.content.match(/#(\w+)/g);
        if (hashtags) {
          for (const rawTag of hashtags) {
            const tagName = rawTag.slice(1).toLowerCase(); // Remove "#"
            const tag = await tx.hashtag.upsert({
              where: { name: tagName },
              update: {},
              create: { name: tagName },
            });
            await tx.postHashtag.create({
              data: {
                postId: post.id,
                hashtagId: tag.id,
              },
            });
          }
        }
      }

      if (data.type === "POLL" && data.pollQuestion && data.pollOptions) {
        await tx.poll.create({
          data: {
            postId: post.id,
            question: data.pollQuestion,
            options: {
              create: data.pollOptions.map((text: string) => ({ text })),
            },
          },
        });
      }

      return post;
    });
  }

  static async findById(id: string) {
    return prisma.post.findUnique({
      where: { id },
      include: {
        user: { include: { profile: true } },
        poll: { include: { options: { include: { votes: true } } } },
        reactions: true,
        comments: {
          where: { parentId: null },
          include: {
            user: { include: { profile: true } },
            replies: {
              include: {
                user: { include: { profile: true } },
              },
            },
          },
        },
      },
    });
  }

  static async deletePost(id: string) {
    return prisma.post.delete({
      where: { id },
    });
  }

  // To match schema: @@unique([userId, postId, commentId, reelId])
  static async toggleReaction(data: {
    userId: string;
    postId?: string;
    commentId?: string;
    reelId?: string;
    type: string;
  }) {
    const existing = await prisma.reaction.findFirst({
      where: {
        userId: data.userId,
        postId: data.postId ?? null,
        commentId: data.commentId ?? null,
        reelId: data.reelId ?? null,
      },
    });

    if (existing) {
      if (existing.type === data.type) {
        // Delete reaction
        await prisma.reaction.delete({
          where: { id: existing.id },
        });
        return { action: "removed" };
      } else {
        // Update reaction type
        await prisma.reaction.update({
          where: { id: existing.id },
          data: { type: data.type },
        });
        return { action: "updated", type: data.type };
      }
    } else {
      // Create new reaction
      await prisma.reaction.create({
        data: {
          userId: data.userId,
          postId: data.postId || null,
          commentId: data.commentId || null,
          reelId: data.reelId || null,
          type: data.type,
        },
      });
      return { action: "added", type: data.type };
    }
  }

  static async addComment(data: {
    userId: string;
    content: string;
    postId?: string;
    reelId?: string;
    parentId?: string;
  }) {
    return prisma.comment.create({
      data: {
        userId: data.userId,
        content: data.content,
        postId: data.postId || null,
        reelId: data.reelId || null,
        parentId: data.parentId || null,
      },
      include: {
        user: { include: { profile: true } },
      },
    });
  }

  static async votePoll(optionId: string, userId: string) {
    // A user can vote once per poll. We need to clear any votes by this user in the same poll.
    const option = await prisma.pollOption.findUnique({
      where: { id: optionId },
      include: { poll: true },
    });

    if (!option) throw new Error("Option not found");

    // Remove any previous votes by user on this poll
    const siblingOptions = await prisma.pollOption.findMany({
      where: { pollId: option.pollId },
    });

    await prisma.pollVote.deleteMany({
      where: {
        userId,
        optionId: { in: siblingOptions.map(o => o.id) },
      },
    });

    // Create the new vote
    return prisma.pollVote.create({
      data: { optionId, userId },
    });
  }

  static async savePost(userId: string, postId: string, collectionId?: string) {
    return prisma.bookmark.create({
      data: {
        userId,
        postId,
        collectionId: collectionId || null,
      },
    });
  }

  static async unsavePost(userId: string, postId: string) {
    return prisma.bookmark.delete({
      where: {
        userId_postId: { userId, postId },
      },
    });
  }

  static async createCollection(userId: string, name: string) {
    return prisma.bookmarkCollection.create({
      data: { userId, name },
    });
  }

  static async getCollections(userId: string) {
    return prisma.bookmarkCollection.findMany({
      where: { userId },
      include: {
        bookmarks: {
          include: {
            post: {
              include: { user: { include: { profile: true } } },
            },
          },
        },
      },
    });
  }
}
