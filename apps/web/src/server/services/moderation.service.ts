import { prisma } from "@/lib/db";

// Simple blacklist of sensitive/moderated terms
const BANNED_WORDS = [
  "spam",
  "scam",
  "hack",
  "exploit",
  "hacker",
  "stolen",
  "illegal",
];

export class ModerationService {
  /**
   * Scans a text snippet for flagged words/phrases.
   * Returns true if flagged, false otherwise.
   */
  static isContentFlagged(content: string): boolean {
    if (!content) return false;
    const lower = content.toLowerCase();
    return BANNED_WORDS.some((word) => lower.includes(word));
  }

  /**
   * Submits a report against a post or comment
   */
  static async reportContent(params: {
    reporterId: string;
    postId?: string;
    commentId?: string;
    reason: string;
  }) {
    const { reporterId, postId, commentId, reason } = params;

    try {
      return prisma.report.create({
        data: {
          reporterId,
          postId: postId || null,
          reason,
          details: commentId ? `Comment ID: ${commentId}` : null,
          status: "PENDING",
        },
      });
    } catch (error) {
      console.error("reportContent error:", error);
      return null;
    }
  }
}
