import { prisma } from "@/lib/db";

export class UserRepository {
  static async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
  }

  static async findByUsername(username: string) {
    return prisma.user.findFirst({
      where: { profile: { username } },
      include: { profile: true },
    });
  }

  static async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
  }

  static async updateProfile(userId: string, data: {
    displayName?: string;
    bio?: string;
    websiteUrl?: string;
    location?: string;
    privacyLevel?: "PUBLIC" | "FRIENDS" | "PRIVATE";
    avatarUrl?: string;
    coverUrl?: string;
  }) {
    return prisma.profile.update({
      where: { userId },
      data,
    });
  }

  static async getFollowers(userId: string) {
    return prisma.follow.findMany({
      where: { followeeId: userId },
      include: {
        follower: {
          include: { profile: true },
        },
      },
    });
  }

  static async getFollowing(userId: string) {
    return prisma.follow.findMany({
      where: { followerId: userId },
      include: {
        followee: {
          include: { profile: true },
        },
      },
    });
  }

  static async followUser(followerId: string, followeeId: string) {
    return prisma.follow.create({
      data: { followerId, followeeId },
    });
  }

  static async unfollowUser(followerId: string, followeeId: string) {
    return prisma.follow.delete({
      where: {
        followerId_followeeId: { followerId, followeeId },
      },
    });
  }

  static async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    const record = await prisma.follow.findUnique({
      where: {
        followerId_followeeId: { followerId, followeeId },
      },
    });
    return !!record;
  }

  static async blockUser(blockerId: string, blockedId: string) {
    // Also unfollow automatically
    await prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: blockerId, followeeId: blockedId },
          { followerId: blockedId, followeeId: blockerId }
        ]
      }
    });

    return prisma.block.create({
      data: { blockerId, blockedId },
    });
  }

  static async unblockUser(blockerId: string, blockedId: string) {
    return prisma.block.delete({
      where: {
        blockerId_blockedId: { blockerId, blockedId },
      },
    });
  }

  static async getBlockList(userId: string) {
    return prisma.block.findMany({
      where: { blockerId: userId },
      include: {
        blocked: {
          include: { profile: true },
        },
      },
    });
  }
}
