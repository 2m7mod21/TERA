import { prisma } from "@/lib/db";
import { BlockedWord } from "@prisma/client";

// Simple in-memory cache with reload support
class ModerationCache {
  private static words: BlockedWord[] = [];
  private static lastUpdated = 0;
  private static CACHE_TTL = 60 * 1000; // 1 minute auto-refresh fallback

  static async getBlockedWords(): Promise<BlockedWord[]> {
    const now = Date.now();
    if (this.words.length === 0 || now - this.lastUpdated > this.CACHE_TTL) {
      await this.reload();
    }
    return this.words;
  }

  static async reload() {
    try {
      this.words = await prisma.blockedWord.findMany({
        where: { isActive: true },
      });
      this.lastUpdated = Date.now();
      console.log(`[ModerationCache] Loaded ${this.words.length} active blocked words.`);
    } catch (err) {
      console.error("[ModerationCache] Failed to load blocked words:", err);
    }
  }
}

// Advanced Leetspeak and Arabic character normalizations
const LEET_MAP: Record<string, string> = {
  "@": "a", "4": "a",
  "1": "i", "!": "i", "|": "i",
  "0": "o",
  "3": "e",
  "5": "s", "$": "s",
  "7": "t", "+": "t",
  "8": "b",
  "9": "g"
};

const ARABIC_DECORATION_REGEX = /[\u0617-\u061A\u064B-\u0652\u0670]/g; // Harakat
const KASHIDA_REGEX = /\u0640/g; // Tatweel

export function normalizeText(text: string): {
  normalizedWords: string[];
  joinedNoSpaces: string;
} {
  if (!text) return { normalizedWords: [], joinedNoSpaces: "" };

  const lowercase = text.toLowerCase();

  // 1. Arabic Normalization
  let processed = lowercase
    .replace(ARABIC_DECORATION_REGEX, "")
    .replace(KASHIDA_REGEX, "");

  // Standardize similar Arabic characters
  processed = processed
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىئ]/g, "ي");

  // 2. English Leetspeak normalization
  let leetReplaced = "";
  for (let i = 0; i < processed.length; i++) {
    const char = processed[i];
    if (char) {
      leetReplaced += (LEET_MAP as Record<string, string>)[char] || char;
    }
  }

  // 3. Remove consecutive repeated characters (e.g. "baaaad" -> "bad", "ككككللمممه" -> "كلمه")
  let collapsed = "";
  for (let i = 0; i < leetReplaced.length; i++) {
    const char = leetReplaced[i];
    if (char && (collapsed.length === 0 || char !== collapsed[collapsed.length - 1])) {
      collapsed += char;
    }
  }

  // 4. Split into words using any non-alphanumeric boundaries (matches bypass like "b.a.d-w.o.r.d")
  // For Arabic, we preserve the range \u0600-\u06FF
  const wordRegex = /[a-z0-9\u0600-\u06FF]+/g;
  const normalizedWords = collapsed.match(wordRegex) || [];

  // Also construct a version with all non-alphanumeric characters stripped entirely
  const joinedNoSpaces = collapsed.replace(/[^a-z0-9\u0600-\u06FF]/g, "");

  return {
    normalizedWords,
    joinedNoSpaces,
  };
}

export interface ModerationResult {
  allowed: boolean;
  reason: "INSULT" | "PROFANITY" | "SEXUAL" | "HATE" | "HARASSMENT" | "SPAM" | null;
  matchedWords: string[];
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
  cleanText: string;
}

export class ModerationService {
  /**
   * Reload cache manually (call when admin modifies blocked word database)
   */
  static async reloadCache() {
    await ModerationCache.reload();
  }

  /**
   * Evaluates text for profanity, returning detailed matching and severity information.
   */
  static async checkText(text: string): Promise<ModerationResult> {
    const result: ModerationResult = {
      allowed: true,
      reason: null,
      matchedWords: [],
      severity: null,
      cleanText: text,
    };

    if (!text || text.trim() === "") return result;

    const blockedList = await ModerationCache.getBlockedWords();
    if (blockedList.length === 0) return result;

    // Normalize input text
    const { normalizedWords, joinedNoSpaces } = normalizeText(text);

    // Track matched blocked word items
    const matchedItems: BlockedWord[] = [];

    for (const item of blockedList) {
      const blockedWordRaw = item.word.toLowerCase();
      // Normalize the blocked word as well to ensure consistent matching
      const { normalizedWords: [blockedWordNorm] } = normalizeText(blockedWordRaw);
      
      const targetPattern = blockedWordNorm || blockedWordRaw;

      // 1. Direct word matching (discrete check)
      const hasDirectMatch = normalizedWords.includes(targetPattern);

      // 2. Substring matching (only for words of length >= 4 to avoid false positives like "ass" in "class")
      const isLongWord = targetPattern.length >= 4;
      const hasSubstringMatch = isLongWord && joinedNoSpaces.includes(targetPattern);

      if (hasDirectMatch || hasSubstringMatch) {
        matchedItems.push(item);
      }
    }

    if (matchedItems.length > 0) {
      // Find the highest severity level
      const severityScores = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
      const firstItem = matchedItems[0];
      if (!firstItem) return result;

      let highestItem = firstItem;
      let highestScore = severityScores[highestItem.severity as keyof typeof severityScores] || 1;

      for (const item of matchedItems) {
        const score = severityScores[item.severity as keyof typeof severityScores] || 1;
        if (score > highestScore) {
          highestScore = score;
          highestItem = item;
        }
      }

      // Group unique matched words
      const uniqueMatchedWords = Array.from(new Set(matchedItems.map(item => item.word)));

      result.allowed = false;
      result.reason = highestItem.category as any;
      result.severity = highestItem.severity as any;
      result.matchedWords = uniqueMatchedWords;

      // Censor the matched terms in the original text (Replace mode)
      let censored = text;
      for (const rawWord of uniqueMatchedWords) {
        // Safe regex escape
        const escaped = rawWord.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        // Matches word boundaries, variations with characters in between (e.g. b.a.d.w.o.r.d)
        // Creating a loose regex mapping for each letter
        const chars = rawWord.split("").map((c: string) => {
          const escC = c.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
          const leetOptions = Object.keys(LEET_MAP).filter((k: string) => (LEET_MAP as Record<string, string>)[k] === c.toLowerCase());
          const options = [escC, ...leetOptions].join("|");
          return `(?:${options})[\\s\\W_\\-]*`;
        }).join("");

        try {
          const regex = new RegExp(chars, "gi");
          censored = censored.replace(regex, (match) => "*".repeat(match.length));
        } catch {
          // Fallback to simple replace
          censored = censored.replace(new RegExp(escaped, "gi"), "*".repeat(rawWord.length));
        }
      }
      result.cleanText = censored;
    }

    return result;
  }
}
