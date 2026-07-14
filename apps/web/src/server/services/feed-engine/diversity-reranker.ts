export interface DiversityCandidate {
  post: any;
  sources: string[];
  finalScore: number;
}

export interface DiversityOptions {
  maxPerAuthor?: number;
  trendingGuaranteedEvery?: number;
  coldStartGuaranteedEvery?: number;
  explorationSlotPct?: number;
  qualityFloor?: number;
}

export class DiversityReranker {
  /**
   * Re-rank a scored candidate list applying:
   * 1. Quality floor exclusion
   * 2. No two consecutive same-author posts
   * 3. Max N posts per author per page
   * 4. Guaranteed trending slot every N positions
   * 5. Guaranteed cold-start slot every N positions
   * 6. Exploration slots: % of positions from content-match pool
   */
  static rerank(
    candidates: DiversityCandidate[],
    limit: number,
    options: DiversityOptions = {}
  ): any[] {
    const {
      maxPerAuthor = 2,
      trendingGuaranteedEvery = 8,
      coldStartGuaranteedEvery = 10,
      explorationSlotPct = 0.10,
      qualityFloor = 0.0,
    } = options;

    // 1. Quality floor exclusion
    const eligible = candidates.filter((c) => {
      const quality = c.post._qualityMultiplier ?? 1.0;
      return quality > qualityFloor;
    });

    // Partition by source
    const trending = eligible.filter((c) => c.sources.includes("trending"));
    const coldStart = eligible.filter((c) => c.sources.includes("cold-start"));
    const contentMatch = eligible.filter((c) => c.sources.includes("content-match"));
    const others = eligible.filter(
      (c) => !c.sources.includes("trending") && !c.sources.includes("cold-start")
    );

    // Calculate exploration slots
    const numExplorationSlots = Math.floor(limit * explorationSlotPct);
    const explorationPosts = contentMatch.slice(0, numExplorationSlots).map((c) => c.post);
    const explorationPostIds = new Set(explorationPosts.map((p: any) => p.id));

    // Build the base ordered list (excluding exploration)
    const basePool = [...others, ...trending, ...contentMatch].filter(
      (c) => !explorationPostIds.has(c.post.id)
    );

    const result: any[] = [];
    const authorCount = new Map<string, number>();
    let lastAuthorId: string | null = null;
    const usedIds = new Set<string>();

    // Dequeue pools
    const trendingQueue = [...trending];
    const coldStartQueue = [...coldStart];

    function pushPost(candidate: DiversityCandidate | undefined, forceConsecutive = false): boolean {
      if (!candidate) return false;
      const authorId: string = candidate.post.userId;
      if (usedIds.has(candidate.post.id)) return false;
      if (!forceConsecutive && authorId === lastAuthorId) return false;
      if ((authorCount.get(authorId) ?? 0) >= maxPerAuthor) return false;

      result.push(candidate.post);
      usedIds.add(candidate.post.id);
      authorCount.set(authorId, (authorCount.get(authorId) ?? 0) + 1);
      lastAuthorId = authorId;
      return true;
    }

    while (result.length < limit - numExplorationSlots) {
      const pos = result.length;

      // Guaranteed trending slot
      if (trendingGuaranteedEvery > 0 && pos > 0 && pos % trendingGuaranteedEvery === 0) {
        const tq = trendingQueue.find((c) => !usedIds.has(c.post.id) && c.post.userId !== lastAuthorId);
        if (tq && pushPost(tq)) continue;
      }

      // Guaranteed cold-start slot
      if (coldStartGuaranteedEvery > 0 && pos > 0 && pos % coldStartGuaranteedEvery === 0) {
        const cq = coldStartQueue.find((c) => !usedIds.has(c.post.id) && c.post.userId !== lastAuthorId);
        if (cq && pushPost(cq)) continue;
      }

      // Normal slot: greedy search for first eligible in basePool
      const next = basePool.find(
        (c) =>
          !usedIds.has(c.post.id) &&
          c.post.userId !== lastAuthorId &&
          (authorCount.get(c.post.userId) ?? 0) < maxPerAuthor
      );

      if (next) {
        pushPost(next);
      } else {
        // Fallback: relax consecutive check to prevent empty slot
        const fallback = basePool.find(
          (c) =>
            !usedIds.has(c.post.id) &&
            (authorCount.get(c.post.userId) ?? 0) < maxPerAuthor
        );
        if (fallback) {
          pushPost(fallback, true);
        } else {
          break;
        }
      }
    }

    // Intersperse exploration slots evenly into the result
    if (numExplorationSlots > 0 && explorationPosts.length > 0) {
      const step = Math.max(1, Math.floor(result.length / numExplorationSlots));
      let insertIdx = step;
      for (const ep of explorationPosts) {
        if (insertIdx <= result.length) {
          result.splice(insertIdx, 0, ep);
          insertIdx += step + 1;
        }
      }
    }

    return result.slice(0, limit);
  }
}
