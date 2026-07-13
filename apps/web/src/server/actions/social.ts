"use server";

import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createNotification } from "./notifications";
import { emitNotification } from "@/server/socket/index";

export async function followUser(targetUserId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (session.user.id === targetUserId) return { success: false, error: "Cannot follow yourself" };

  try {
    await prisma.follow.create({
      data: { followerId: session.user.id, followeeId: targetUserId },
    });
    // Create notification + emit real-time
    const n = await createNotification({
      receiverId: targetUserId,
      senderId: session.user.id,
      type: "FOLLOW",
      entityId: session.user.id,
      entityType: "USER",
      priority: 1,
    });
    if (n) emitNotification(targetUserId, n);
    revalidatePath("/");
    return { success: true, following: true };
  } catch {
    return { success: false, error: "Already following" };
  }
}

export async function unfollowUser(targetUserId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await prisma.follow.deleteMany({
      where: { followerId: session.user.id, followeeId: targetUserId },
    });
    revalidatePath("/");
    return { success: true, following: false };
  } catch {
    return { success: false, error: "Failed to unfollow" };
  }
}

export async function getProfileByUsername(username: string) {
  const session = await auth();
  const profile = await prisma.profile.findUnique({
    where: { username },
    include: {
      user: {
        include: {
          followers: true,
          following: true,
        },
      },
    },
  });

  if (!profile) return null;

  let isFollowing = false;
  let isOwnProfile = false;
  let isMuted = false;
  let isRestricted = false;

  if (session?.user?.id) {
    isOwnProfile = session.user.id === profile.userId;
    if (!isOwnProfile) {
      const [follow, mute, restrict] = await Promise.all([
        prisma.follow.findFirst({
          where: { followerId: session.user.id, followeeId: profile.userId },
        }),
        prisma.mute.findFirst({
          where: { muterId: session.user.id, mutedId: profile.userId },
        }),
        (prisma as any).userRestrict.findFirst({
          where: { restrictorId: session.user.id, restrictedId: profile.userId },
        }),
      ]);
      isFollowing = !!follow;
      isMuted = !!mute;
      isRestricted = !!restrict;
    }
  }

  const visibilityCondition = isOwnProfile
    ? { in: ["PUBLIC", "FRIENDS", "PRIVATE"] }
    : isFollowing
    ? { in: ["PUBLIC", "FRIENDS"] }
    : "PUBLIC";

  // Query actual posts matching authorized visibility
  const dbPosts = await prisma.post.findMany({
    where: {
      userId: profile.userId,
      visibility: visibilityCondition,
    },
    orderBy: { createdAt: "desc" },
    include: {
      reactions: true,
      comments: {
        orderBy: { createdAt: "asc" },
        include: { user: { include: { profile: true } } },
      },
      _count: { select: { comments: true, reactions: true } },
      parentPost: {
        include: {
          user: { include: { profile: true } },
          reactions: true,
          poll: { include: { options: { include: { votes: true } } } },
          shares: { select: { userId: true, content: true } },
          _count: { select: { comments: true, reactions: true } },
        }
      },
      shares: { select: { userId: true, content: true } },
      bookmarks: session?.user?.id ? {
        where: { userId: session.user.id },
        select: { id: true },
      } : undefined,
    },
  });

  // Get pinned posts matching authorized visibility
  const pinnedPosts = await (prisma.post as any).findMany({
    where: {
      userId: profile.userId,
      isPinned: true,
      visibility: visibilityCondition,
    },
    include: {
      user: { include: { profile: true } },
      reactions: true,
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Map posts to include the user object expected by PostCard
  const postsWithUser = dbPosts.map((post: any) => ({
    ...post,
    user: {
      id: profile.user.id,
      profile: {
        avatarUrl: profile.avatarUrl,
        displayName: profile.displayName,
        username: profile.username,
      },
    },
  }));

  const mappedProfile = {
    ...profile,
    user: {
      ...profile.user,
      posts: postsWithUser,
    },
  };

  return {
    profile: mappedProfile,
    isFollowing,
    isOwnProfile,
    currentUserId: session?.user?.id ?? null,
    isMuted,
    isRestricted,
    pinnedPosts,
  };
}

export async function updateProfile(data: {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  websiteUrl?: string;
  location?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await prisma.profile.update({
      where: { userId: session.user.id },
      data,
    });
    revalidatePath("/");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update profile" };
  }
}

export async function getConversations() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const participants = await prisma.conversationParticipant.findMany({
    where: { userId: session.user.id },
    include: {
      conversation: {
        include: {
          participants: {
            include: { user: { include: { profile: true } } },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return participants.map((p) => ({
    ...p.conversation,
    otherUser: p.conversation.participants
      .find((pp) => pp.userId !== session.user.id)
      ?.user ?? null,
    lastMessage: p.conversation.messages[0] ?? null,
  }));
}

export async function getOrCreateDM(targetUserId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  // Check if DM already exists
  const existing = await prisma.conversationParticipant.findFirst({
    where: {
      userId: session.user.id,
      conversation: {
        isGroup: false,
        participants: { some: { userId: targetUserId } },
      },
    },
    include: { conversation: true },
  });

  if (existing) return { success: true, conversationId: existing.conversationId };

  const conv = await prisma.conversation.create({
    data: {
      isGroup: false,
      participants: {
        create: [
          { userId: session.user.id, role: "MEMBER" },
          { userId: targetUserId, role: "MEMBER" },
        ],
      },
    },
  });

  return { success: true, conversationId: conv.id };
}

export async function getChatMessages(conversationId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  // Verify user is in conversation
  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: session.user.id },
  });
  if (!participant) return [];

  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    include: { sender: { include: { profile: true } } },
  });
}

export async function sendMessage(conversationId: string, content: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: session.user.id },
  });
  if (!participant) return { success: false, error: "Not a participant" };

  const message = await prisma.message.create({
    data: { conversationId, senderId: session.user.id, content },
    include: { sender: { include: { profile: true } } },
  });

  return { success: true, message };
}

export async function getNotifications() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.notification.findMany({
    where: { receiverId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      sender: { include: { profile: true } },
    },
  });
}

export async function markNotificationsRead() {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.notification.updateMany({
    where: { receiverId: session.user.id, isRead: false },
    data: { isRead: true },
  });
}

export async function getSuggestedUsers() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const myFollowing = await prisma.follow.findMany({
    where: { followerId: session.user.id },
    select: { followeeId: true },
  });
  const followingIds = myFollowing.map((f) => f.followeeId);

  return prisma.profile.findMany({
    where: {
      userId: { notIn: [...followingIds, session.user.id] },
    },
    take: 8,
    orderBy: { updatedAt: "desc" },
    include: {
      user: {
        include: {
          followers: true,
          _count: { select: { posts: true } },
        },
      },
    },
  });
}

export async function searchUsers(query: string) {
  if (!query.trim()) return [];
  return prisma.profile.findMany({
    where: {
      OR: [
        { displayName: { contains: query } },
        { username: { contains: query } },
      ],
    },
    take: 10,
    include: { user: { include: { followers: true } } },
  });
}

export async function restrictUser(targetUserId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (session.user.id === targetUserId) return { success: false, error: "Cannot restrict yourself" };

  try {
    await (prisma as any).userRestrict.create({
      data: { restrictorId: session.user.id, restrictedId: targetUserId },
    });
    return { success: true, action: "restricted" };
  } catch {
    return { success: false, error: "Already restricted" };
  }
}

export async function unrestrictUser(targetUserId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await (prisma as any).userRestrict.deleteMany({
      where: { restrictorId: session.user.id, restrictedId: targetUserId },
    });
    return { success: true, action: "unrestricted" };
  } catch {
    return { success: false, error: "Failed to unrestrict" };
  }
}

export async function muteUser(targetUserId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (session.user.id === targetUserId) return { success: false, error: "Cannot mute yourself" };

  try {
    await prisma.mute.create({
      data: { muterId: session.user.id, mutedId: targetUserId },
    });
    return { success: true, action: "muted" };
  } catch {
    return { success: false, error: "Already muted" };
  }
}

export async function unmuteUser(targetUserId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await prisma.mute.deleteMany({
      where: { muterId: session.user.id, mutedId: targetUserId },
    });
    return { success: true, action: "unmuted" };
  } catch {
    return { success: false, error: "Failed to unmute" };
  }
}

export async function reportProfile(targetUserId: string, reason: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (session.user.id === targetUserId) return { success: false, error: "Cannot report yourself" };

  try {
    // Queue in moderation
    await prisma.moderationQueue.create({
      data: {
        entityType: "USER",
        entityId: targetUserId,
        flagReason: reason,
      },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to submit report" };
  }
}

export async function getProfileRelationship(viewerId: string, targetUserId: string) {
  const [isFollowing, isBlocked, isMuted, isRestricted] = await Promise.all([
    prisma.follow.findFirst({ where: { followerId: viewerId, followeeId: targetUserId } }),
    prisma.block.findFirst({ where: { blockerId: viewerId, blockedId: targetUserId } }),
    prisma.mute.findFirst({ where: { muterId: viewerId, mutedId: targetUserId } }),
    prisma.userRestrict.findFirst({ where: { restrictorId: viewerId, restrictedId: targetUserId } }),
  ]);
  return {
    isFollowing: !!isFollowing,
    isBlocked: !!isBlocked,
    isMuted: !!isMuted,
    isRestricted: !!isRestricted,
  };
}

export async function getFriendsList() {
  const session = await auth();
  if (!session?.user?.id) return [];
  try {
    const follows = await prisma.follow.findMany({
      where: { followerId: session.user.id },
      include: {
        followee: {
          include: {
            profile: true
          }
        }
      }
    });
    return follows.map((f) => ({
      id: f.followee.id,
      displayName: f.followee.profile?.displayName || f.followee.email || "User",
      username: f.followee.profile?.username || "user",
      avatarUrl: f.followee.profile?.avatarUrl || null,
    }));
  } catch (error) {
    console.error("Failed to get friends list:", error);
    return [];
  }
}

