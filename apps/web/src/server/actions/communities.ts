"use server";

import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

// Group Actions
export async function createGroup(name: string, description?: string, isPrivate = false, coverUrl?: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const group = await prisma.group.create({
      data: {
        name,
        description: description || null,
        ownerId: session.user.id,
        isPrivate,
        coverUrl: coverUrl || null,
        members: {
          create: {
            userId: session.user.id,
            role: "ADMIN",
          },
        },
      },
    });
    revalidatePath("/groups");
    return { success: true, group };
  } catch (error) {
    console.error("Create group Action error:", error);
    return { success: false, error: "Failed to create group" };
  }
}

export async function joinGroup(groupId: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return { success: false, error: "Group not found" };

    if (group.isPrivate) {
      // Create join request
      const req = await prisma.groupJoinRequest.upsert({
        where: { groupId_userId: { groupId, userId: session.user.id } },
        update: { status: "PENDING" },
        create: { groupId, userId: session.user.id, status: "PENDING" },
      });
      revalidatePath(`/groups/${groupId}`);
      return { success: true, request: req, status: "PENDING" };
    }

    const member = await prisma.groupMember.create({
      data: {
        groupId,
        userId: session.user.id,
        role: "MEMBER",
      },
    });
    revalidatePath(`/groups/${groupId}`);
    return { success: true, member, status: "MEMBER" };
  } catch (error) {
    console.error("Join group Action error:", error);
    return { success: false, error: "Failed to join group" };
  }
}

export async function leaveGroup(groupId: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    await prisma.groupMember.delete({
      where: {
        groupId_userId: {
          groupId,
          userId: session.user.id,
        },
      },
    });
    revalidatePath(`/groups/${groupId}`);
    return { success: true };
  } catch (error) {
    console.error("Leave group error:", error);
    return { success: false, error: "Failed to leave group" };
  }
}

export async function getGroupDetails(groupId: string) {
  try {
    return prisma.group.findUnique({
      where: { id: groupId },
      include: {
        owner: { include: { profile: true } },
        members: { include: { user: { include: { profile: true } } } },
        rules: { orderBy: { sortOrder: "asc" } },
        announcements: { orderBy: { createdAt: "desc" } },
        posts: {
          where: { visibility: "PUBLIC" },
          include: {
            user: { include: { profile: true } },
            reactions: true,
            _count: { select: { comments: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  } catch (error) {
    console.error("getGroupDetails error:", error);
    return null;
  }
}

export async function getJoinRequests(groupId: string) {
  const session = await auth();
  if (!session?.user) return [];

  try {
    // Verify user is owner/admin
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.user.id } },
    });
    if (!membership || !["ADMIN", "MODERATOR"].includes(membership.role)) {
      return [];
    }

    return prisma.groupJoinRequest.findMany({
      where: { groupId, status: "PENDING" },
      include: { user: { include: { profile: true } } },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

export async function handleJoinRequest(requestId: string, approve: boolean) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    const req = await prisma.groupJoinRequest.findUnique({ where: { id: requestId } });
    if (!req) return { success: false, error: "Request not found" };

    // Verify operator is admin/mod
    const adminCheck = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: req.groupId, userId: session.user.id } },
    });
    if (!adminCheck || !["ADMIN", "MODERATOR"].includes(adminCheck.role)) {
      return { success: false, error: "Forbidden" };
    }

    if (approve) {
      await prisma.$transaction([
        prisma.groupJoinRequest.update({
          where: { id: requestId },
          data: { status: "APPROVED" },
        }),
        prisma.groupMember.create({
          data: {
            groupId: req.groupId,
            userId: req.userId,
            role: "MEMBER",
          },
        }),
      ]);
    } else {
      await prisma.groupJoinRequest.update({
        where: { id: requestId },
        data: { status: "DENIED" },
      });
    }

    revalidatePath(`/groups/${req.groupId}`);
    return { success: true };
  } catch (error) {
    console.error("handleJoinRequest error:", error);
    return { success: false, error: "Action execution failure" };
  }
}

export async function createAnnouncement(groupId: string, content: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.user.id } },
    });
    if (!membership || !["ADMIN", "MODERATOR"].includes(membership.role)) {
      return { success: false, error: "Forbidden" };
    }

    const ann = await prisma.groupAnnouncement.create({
      data: {
        groupId,
        content,
        authorId: session.user.id,
      },
    });

    revalidatePath(`/groups/${groupId}`);
    return { success: true, announcement: ann };
  } catch {
    return { success: false, error: "Failed to create announcement" };
  }
}

export async function createGroupRule(groupId: string, title: string, description?: string) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  try {
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.user.id } },
    });
    if (!membership || membership.role !== "ADMIN") {
      return { success: false, error: "Forbidden" };
    }

    const rule = await prisma.groupRule.create({
      data: {
        groupId,
        title,
        description: description || null,
      },
    });

    revalidatePath(`/groups/${groupId}`);
    return { success: true, rule };
  } catch (error) {
    return { success: false, error: "Failed to create rule" };
  }
}

// Directory loaders
export async function getJoinedGroups() {
  const session = await auth();
  if (!session?.user) return [];

  return prisma.group.findMany({
    where: {
      members: { some: { userId: session.user.id } },
    },
    include: {
      _count: { select: { members: true } },
    },
  });
}

export async function getExploreGroups() {
  const session = await auth();
  if (!session?.user) return [];

  return prisma.group.findMany({
    where: {
      NOT: { members: { some: { userId: session.user.id } } },
    },
    include: {
      _count: { select: { members: true } },
    },
    take: 12,
  });
}

export async function getFollowedPages() {
  const session = await auth();
  if (!session?.user) return [];

  return prisma.page.findMany({
    where: {
      followers: { some: { userId: session.user.id } },
    },
    include: {
      followers: true,
    },
  });
}
