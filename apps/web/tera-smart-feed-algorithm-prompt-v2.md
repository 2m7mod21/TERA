# Professional Recommendation & Ranking Engine - "TERA" Social Platform (v2)
### A real two-stage retrieval + ranking system, tunable without code changes, verifiably working

> This document supersedes and extends the earlier "Smart Feed Algorithm Implementation Prompt." Everything from that document is preserved and folded in below with additional professional-grade components.

---

## 0. META-INSTRUCTIONS FOR THE AI (READ FIRST)

1. **Existing codebase.** Audit what's already built (including any earlier version of this ranking system) before writing anything new. Complete what's partial, add what's missing, keep what already works.
2. **This is a two-stage system: Candidate Generation, then Ranking.** This is how production-grade recommendation systems are actually structured (this is the same pattern used by YouTube, Twitter/X, and TikTok). Do not collapse the two stages into one giant query - keep them as clearly separated, independently testable components.
3. **Build in the phased order in Section 5.** Verify each phase per Section 6 before moving to the next. This system has many moving parts; building it all at once is how it silently breaks.
4. **No hardcoded tuning constants.** Every weight, threshold, and cap used anywhere in this system must be read from the configurable Weights system (Section 3.12) - not a hardcoded number in the code. This is non-negotiable and is what makes this a professional system instead of a fixed demo.
5. **Prove it works with evidence, not claims.** Section 6 is mandatory, not optional polish.
6. **Preserve the plain chronological "Recent" mode**, completely untouched by any of this - it must remain available as a simple fallback at all times.

---

## 1. SYSTEM ARCHITECTURE OVERVIEW

```
 [ Stage 1: CANDIDATE GENERATION ]        [ Stage 2: RANKING ]
 Multiple independent sources pull   -->  Score every candidate  -->  Re-rank for
 a pool of eligible posts for this        with the full formula      diversity, fatigue,
 specific viewer                          (Section 3.11)             quality floor, and
                                                                      guaranteed slots
                                                                      (trending, cold-start,
                                                                      exploration)
                                                                            |
                                                                            v
                                                                  Final ordered feed
                                                                  + impression log written
```

Every candidate carries a `source` tag (following, content-match, collaborative, trending, cold-start) into the ranking stage, so the re-ranking pass can enforce guaranteed slot mixes (e.g. "at least 1 trending item and 1 cold-start item per 20 posts") regardless of how the raw scores land.

---

## 2. DATA MODEL REQUIREMENTS (extend the existing schema)

In addition to everything specified in the earlier version (interaction events, affinity table, topic-affinity table, suppression table, feed impression log), add:

- **Quality/trust signals** - either extend the `users` table or add a `creator_trust` table: `(userId, trustScore, accountAgeDays, verificationStatus, violationCount, lastRecalculatedAt)`.
- **Post quality score cache** - `(postId, qualityScore, spamFlags JSON, lastRecalculatedAt)` so it isn't recomputed from scratch on every request.
- **Exposure/fatigue tracking** - `(userId, targetType [author|topic|post], targetId, shownCount, lastShownAt, engagedCount, windowStartAt)`, reset on a rolling window (session and/or daily).
- **Weights configuration table** - `(profileName, componentKey, weightValue, updatedByAdminId, updatedAt)`, supporting multiple named profiles (Section 3.12), with `componentKey` covering every tunable value in this document (e.g. `affinity.weight`, `engagement.like_weight`, `engagement.comment_weight`, `quality.min_floor`, `fatigue.decay_rate`, `coldstart.boost_duration_days`, `trending.min_slot_frequency`, `exploration.slot_percentage`, etc.).
- **Weights change audit log** - `(id, adminId, profileName, componentKey, oldValue, newValue, changedAt)`.

---

## 3. COMPONENTS (build each fully; every numeric weight referenced below must come from Section 3.12's config, not a literal in code)

### 3.1 Candidate Generation (multi-source)
Retrieve candidate posts from multiple independent sources per request, each returning a bounded, source-tagged pool:
1. **Following/Circle** - posts from accounts the viewer follows (the existing baseline).
2. **Content-based/Interest match** - posts matching the viewer's topic-affinity vector (Section 3.4), from authors the viewer may not follow.
3. **Collaborative** - posts engaged with by people the viewer has a strong affinity with, or by "friends of friends" in the follow graph (mutual-connection signal), even from authors two degrees removed.
4. **Trending** - currently high-velocity posts/topics (Section 3.10), regardless of follow relationship.
5. **Cold-start pool** - recent posts from new/low-history creators that match the viewer's interests, deliberately included to solve the cold-start problem (Section 3.9).

Merge and de-duplicate the pools before passing to Stage 2, keeping each candidate's source tag(s) attached (a post can qualify from more than one source).

### 3.2 Affinity Score
*(unchanged from v1)* Weighted, time-decayed sum of interaction history between viewer and author, incrementally updated per interaction and periodically fully recomputed.

### 3.3 Predicted Engagement
*(unchanged from v1)* Per-post, per-viewer probability proxies for like/comment/share/full-watch, combined with a negative term for predicted hide/report probability. Comments and shares weigh more than passive likes.

### 3.4 Content-Based Interest Matching
*(unchanged from v1, now also feeding Candidate Generation directly)* Per-user topic-affinity vector matched against each candidate's topic tags.

### 3.5 Quality & Spam Score (NEW - required)
Every candidate gets a quality multiplier before final ranking, combining:
- **Author trust score**: account age, verification status, prior violation/mute/ban history (from the moderation system built earlier) - a brand-new or repeatedly-flagged account starts with lower trust.
- **Content integrity signals**: reused/duplicate content detected across many recent posts from the same account in a short window (spam pattern), excessive links/mentions/hashtags relative to normal posting behavior, empty or broken media references.
- **Engagement authenticity**: an abnormal spike pattern (e.g. large like counts with near-zero comments/shares/watch-time, or engagement arriving faster than is plausible) should lower the score rather than raise it, since raw counts alone can be gamed.
- **Live moderation status**: any post with unresolved reports above the priority threshold, or already auto-flagged by the content moderation pipeline (built in the earlier "Fix & Elevate" prompt), gets a hard quality floor - it can be **excluded from ranking entirely**, not just demoted, until reviewed.
Cache this score (Section 2) and recompute it on a schedule plus immediately whenever new reports/moderation flags land on that content or author.

### 3.6 Negative Feedback / Suppression
*(unchanged from v1)* Hide / "see fewer like this" / unfollow / report immediately writes a suppression entry that measurably reduces score for that author/topic, decaying back toward neutral over a defined window unless reinforced.

### 3.7 Fatigue Detection (NEW - required)
Track, per viewer and per rolling window (session + daily), how many times a given author/topic/specific post has already been shown, and whether the viewer engaged with it or scrolled past without engaging:
- **Shown + engaged** → no penalty (this is a positive signal, feeds back into 3.2/3.3 normally).
- **Shown repeatedly + ignored** (no engagement across multiple impressions) → an escalating fatigue penalty on further exposure to that same author/topic within the window, so the feed doesn't keep re-serving something the viewer is visibly not interested in right now.
- **Shown + explicitly hidden** → handled by the stronger Section 3.6 suppression path, not this lighter fatigue path.
Also enforce a hard cap: no more than N posts from a single author within a rolling window, regardless of how high that author's individual scores are - this works alongside the diversity re-ranking pass (Section 3.13), but fatigue is viewer-and-time-window-specific while diversity is feed-position-specific.

### 3.8 Recency Decay
*(unchanged from v1)* A decay function on post age as one scoring input, tuned so strong affinity/engagement can outrank pure freshness, with ties favoring recency.

### 3.9 Creator Cold-Start Handling (NEW - required)
New or low-history creators/posts have little to no affinity or historical-engagement data to score against, which would otherwise keep them permanently invisible (a "rich get richer" failure mode). Fix this explicitly:
- Posts from creators under a configurable age/post-count/follower threshold get pulled into the dedicated cold-start candidate pool (Section 3.1) and receive a temporary visibility boost multiplier in scoring, sized to guarantee them a minimum sample of impressions among viewers whose interests match the post's content (via 3.4), even with zero affinity history.
- This boost decays automatically as the post/creator accumulates real engagement signals, handing off smoothly to the normal scoring components once there's enough data to trust them.
- This must not bypass the quality/spam floor (Section 3.5) - a low-quality new account does not get boosted.

### 3.10 Trending Injection (upgrade of standalone Trending Detection)
Trending topics/posts (computed via the existing engagement-velocity job) are not just surfaced in a separate "Trending" module - they are injected directly into the main ranked feed as a distinct candidate source (Section 3.1) with a **guaranteed minimum slot frequency** (e.g. at least 1 trending-sourced post per N feed positions, configurable in Section 3.12), enforced in the re-ranking pass (Section 3.13) regardless of where trending items would otherwise land purely on score.

### 3.11 Final Scoring Formula
```
finalScore =
   ( affinity              * W.affinity )
 + ( engagementScore        * W.engagement )
 + ( contentMatchScore      * W.contentMatch )
 + ( recencyDecay           * W.recency )
 + ( coldStartBoost         * W.coldStart )         // 0 unless eligible per 3.9
 * qualityMultiplier                                 // from 3.5, can force exclusion
 * suppressionMultiplier                             // from 3.6
 * fatigueMultiplier                                 // from 3.7
```
Every `W.*` weight is read at request time from the active Weights Config profile (Section 3.12) - never hardcoded.

### 3.12 Configurable Weights System (Admin-Controlled) (NEW - required, high priority)
Build a real Admin Dashboard section for this:
- Every tunable weight/threshold/cap in this entire document is stored in the Weights Config table (Section 2), grouped in the UI by component (Affinity, Engagement, Content Match, Recency, Cold Start, Quality Floor, Fatigue, Trending Slot Frequency, Exploration Slot % - see Section 4).
- Admin UI provides sliders/number inputs per weight with sane min/max bounds and inline descriptions of what each one does, a **"Save & Apply"** action that takes effect on the *next* feed computation immediately - no code deploy, no server restart.
- Support multiple named weight **profiles** (e.g. "Default," "Experiment A") from day one, even if only one is active for all users right now - this is what makes true A/B testing (Section 4) a configuration change later, not a rewrite.
- Every change is written to the audit log (Section 2) with who changed what, from what value, to what value, and when.
- Provide a one-click **"Reset to default"** per profile.
This component alone is what turns the algorithm from a fixed piece of code into a genuinely operable system - treat it as equal in priority to the scoring logic itself.

### 3.13 Diversity & Integrity Re-ranking Pass
*(unchanged from v1, now also enforcing fatigue caps)* After scoring, re-rank the top candidates so no two consecutive posts share an author, cap posts-per-author-per-page, enforce the trending and cold-start guaranteed minimum slot frequencies (3.9, 3.10), and exclude/demote anything under the quality floor (3.5) regardless of raw score.

---

## 4. FORWARD-LOOKING SYSTEMS (deferred, but design hooks for them now)

These three are genuinely valuable but need real user-scale data/traffic to pay off, and adding them fully today would add significant complexity for little measurable benefit. Do **not** build their full versions yet - but design today's system so they slot in later without a rewrite:

- **Session-Based Ranking (future):** design the core ranking function to accept an optional `sessionContext` parameter (recent in-session views/engagements) today, even if it's currently unused/ignored - so wiring in real session-awareness later is additive, not a refactor.
- **Exploration/Exploitation (future, e.g. a multi-armed-bandit approach):** reserve a small, currently-fixed **exploration slot percentage** in the re-ranking pass (Section 3.13) - e.g. a configurable percentage (via 3.12) of feed positions filled with a randomized pick from the content-match candidate pool rather than the top-scored item. This is a simple placeholder today that can be upgraded into a real bandit algorithm later without changing where in the pipeline it lives.
- **A/B Testing framework (future):** because the Weights Config (3.12) already supports multiple named profiles, a future A/B test is simply: create a second profile, assign a user segment to it, and compare outcomes via the analytics system (Section 7.8 of the base platform spec) - no schema change needed when this is actually built out with real experiment-assignment and statistical-significance tooling.

Note these three explicitly as "not built yet, hooks only" in your phase completion report - don't silently skip mentioning them, and don't half-build them either.

---

## 5. PHASED BUILD PLAN (build and verify strictly in this order)

**Phase A - Interaction Logging Foundation** *(if not already done)* - full interaction events table, written from every real user action across the app.

**Phase B - Candidate Generation Layer** - build the 5 sources (Section 3.1) as independently callable, testable functions, each returning a bounded, source-tagged pool. Verify each source in isolation before merging them.

**Phase C - Affinity + Content-Match Scoring** - Sections 3.2 and 3.4, if not already built from the earlier version; otherwise verify they still work correctly against the new candidate pool shape.

**Phase D - Predicted Engagement Scoring** - Section 3.3, writing full score breakdowns to the feed impression log.

**Phase E - Quality & Spam Scoring** - Section 3.5, wired live to the existing moderation/report system so a newly-reported or auto-flagged post is demoted/excluded on the very next scoring pass.

**Phase F - Negative Feedback + Fatigue** - Sections 3.6 and 3.7 together, since they're closely related; verify both the "hide → immediate suppression" and "repeated ignore → escalating fatigue penalty" behaviors independently.

**Phase G - Cold Start + Trending Injection** - Sections 3.9 and 3.10, verify new/low-history creators and trending items both reliably get guaranteed exposure.

**Phase H - Final Scoring + Diversity/Integrity Pass** - Section 3.11 and 3.13, combining every component built so far into the real production pipeline.

**Phase I - Configurable Weights Dashboard** - Section 3.12, built as its own dedicated admin feature; verify changing a weight in the UI measurably changes the next feed computation with zero code changes or restarts.

**Phase J - Forward-Looking Hooks** - Section 4's three placeholder hooks (session-context parameter, fixed exploration slot %, multi-profile weights already covered by Phase I).

**Phase K - Verification & Sign-off** - the full Section 6 test suite, run end-to-end against the completed system.

---

## 6. VERIFICATION - PROVE THIS IS ACTUALLY WORKING (mandatory)

All tests from the earlier version still apply (close-friend-vs-stranger ranking test, negative-feedback immediacy test, discovery/content-match test, score-distribution sanity check, A/B chronological-vs-algorithmic comparison logging, performance check, transparency-panel consistency check). Add these:

1. **Quality/spam demotion test** - take a post, simulate it accumulating reports/moderation flags past the threshold, and confirm it drops out of ranked results (or is excluded entirely) on the next computation, without needing a redeploy.
2. **Fatigue test** - simulate a viewer being shown the same author/topic repeatedly across sessions without engaging, and confirm that author/topic's score measurably drops on subsequent feed loads; then simulate the viewer actually engaging once, and confirm the fatigue penalty does not keep escalating for content they do engage with.
3. **Cold-start exposure test** - create a brand-new creator with zero interaction history and a post matching a test viewer's known interests; confirm it appears in that viewer's feed at a reasonable position despite zero affinity, and confirm the boost fades once the creator accumulates enough real engagement in the test.
4. **Trending guaranteed-slot test** - confirm a currently-trending item appears at least once within the configured slot frequency window, even for a viewer whose personal affinity/content-match scores would not otherwise surface it.
5. **Weights Dashboard live-effect test** - change a weight (e.g. lower the recency weight) via the admin UI, request a feed for the same test viewer/candidate pool before and after, and confirm the ordering changes accordingly, with no code change or server restart involved. Confirm the change is recorded in the audit log.
6. **Exploration slot test** - confirm the configured exploration percentage of feed positions are genuinely filled from outside the top-scored candidates, and that this percentage is itself adjustable via the Weights Dashboard.

---

## 7. FINAL QUALITY GATE

- [ ] Candidate Generation runs as 5 independent, source-tagged pools that get merged before ranking.
- [ ] All components in Section 3 (Affinity, Predicted Engagement, Content Match, Quality/Spam, Negative Feedback, Fatigue, Recency, Cold Start, Trending Injection, Final Formula, Diversity Pass) are implemented, connected, and reading their weights from the Weights Config system - zero hardcoded tuning constants remain in the code.
- [ ] The Configurable Weights admin dashboard is live, functional, and every change is audit-logged.
- [ ] The three forward-looking hooks (Section 4) exist in simple placeholder form and are explicitly documented as such.
- [ ] The plain chronological "Recent" mode is untouched and still works.
- [ ] Every test in Section 6 passes, with logged evidence (not just a claim).
- [ ] Feed computation performance remains fast under the added complexity (candidate generation + full scoring + re-ranking) - verify with the same caching approach used elsewhere in the platform.
- [ ] A written phase-by-phase completion report covering Phases A-K, confirming nothing was silently skipped.
