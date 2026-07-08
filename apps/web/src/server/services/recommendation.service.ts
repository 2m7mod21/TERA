import { prisma } from "@/lib/db";

export class RecommendationService {
  /**
   * Suggests users to follow based on mutual friends (mutual follows)
   */
  static async getFriendRecommendations(userId: string, limit = 5) {
    try {
      // 1. Get user following IDs
      const following = await prisma.follow.findMany({
        where: { followerId: userId },
        select: { followeeId: true },
      });
      const followingIds = following.map((f) => f.followeeId);

      // 2. Query candidates whom the user does not follow yet (exclude self and current follows)
      const candidates = await prisma.user.findMany({
        where: {
          id: { notIn: [userId, ...followingIds] },
          isBanned: false,
          isSuspended: false,
        },
        take: 30,
        include: {
          profile: true,
          followers: { select: { followerId: true } },
        },
      });

      // 3. Compute mutual score
      const scored = candidates.map((candidate) => {
        const candidateFollowerIds = candidate.followers.map((f) => f.followerId);
        const mutuals = followingIds.filter((id) => candidateFollowerIds.includes(id));
        return {
          id: candidate.id,
          email: candidate.email,
          profile: candidate.profile,
          mutualCount: mutuals.length,
          score: mutuals.length * 10 + candidate.followers.length,
        };
      });

      // Sort desc
      return scored.sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (error) {
      console.error("getFriendRecommendations error:", error);
      return [];
    }
  }

  /**
   * Suggests groups/communities to join based on user interest and friend memberships
   */
  static async getGroupRecommendations(userId: string, limit = 5) {
    try {
      // 1. Get user joined groups
      const joined = await prisma.groupMember.findMany({
        where: { userId },
        select: { groupId: true },
      });
      const joinedIds = joined.map((j) => j.groupId);

      // 2. Get my friends' (following) joined groups
      const following = await prisma.follow.findMany({
        where: { followerId: userId },
        select: { followeeId: true },
      });
      const followingIds = following.map((f) => f.followeeId);

      const friendMemberships = await prisma.groupMember.findMany({
        where: { userId: { in: followingIds } },
        select: { groupId: true },
      });
      const friendGroupCounts = friendMemberships.reduce((acc, curr) => {
        acc[curr.groupId] = (acc[curr.groupId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // 3. Retrieve groups not joined yet
      const candidates = await prisma.group.findMany({
        where: {
          id: { notIn: joinedIds },
        },
        include: {
          _count: { select: { members: true } },
        },
        take: 20,
      });

      // Score
      const scored = candidates.map((group) => {
        const friendCount = friendGroupCounts[group.id] || 0;
        const totalMembers = group._count?.members || 0;
        return {
          group,
          score: friendCount * 15 + totalMembers,
        };
      });

      return scored
        .sort((a, b) => b.score - a.score)
        .map((x) => x.group)
        .slice(0, limit);
    } catch (error) {
      console.error("getGroupRecommendations error:", error);
      return [];
    }
  }
}
