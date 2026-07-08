# Audit & Completion Prompt - "Nexus" Social Platform
### (Facebook + Instagram + Twitter/X + LinkedIn - combined and improved)

---

## 0. META-INSTRUCTIONS FOR THE AI (READ FIRST - IMPORTANT CONTEXT)

**This is an EXISTING codebase, not a new project.** The app has already been built with Next.js, Node.js, and SQLite. Your job in this task is NOT to rebuild it from scratch, NOT to re-architect what already works, and NOT to delete or replace existing code that is functioning correctly.

Your job is to:

1. **Audit first.** Go through the actual project (pages, components, API routes/server actions, database schema) and compare what exists against the full feature specification below (Sections 3-7). For every feature listed, determine one of three states:
   - ✅ **Exists and works** - leave it alone unless it's actually broken.
   - ⚠️ **Partially exists** - the page/button/model is there but incomplete, broken, or missing part of the described behavior - complete it to match the spec.
   - ❌ **Missing entirely** - build it, following the existing project's structure, conventions, and design system so it feels native to the app, not bolted on.
2. **Produce a short audit report before writing code for each area** (see Section 8): a checklist of what you found in each of the three states above. This report is how we confirm nothing is being silently skipped.
3. **Never remove or break a working feature** to implement a missing one. Regression = failure.
4. **Match the existing codebase's patterns.** Use the same folder structure, naming conventions, ORM, styling approach, and component library already present in the project. Do not introduce a competing pattern (e.g., a second state-management library, a second ORM, a different CSS approach) unless something the spec requires is genuinely impossible with what's already there - and if so, explain why before switching.
5. **Work through the feature areas in PHASES, in order** (Section 8). Do not jump between unrelated areas in one pass - finish auditing and completing one area, confirm it works, then move to the next.
6. **Nothing in Sections 3-7 is optional.** If it's in this document and it's missing from the app, it must be added. If you genuinely cannot implement something (e.g., a hard platform limitation), say so explicitly instead of quietly dropping it.
7. **Code quality bar for anything you add or touch:** strict TypeScript, no `any`, reusable components, proper error/loading/empty states, authentication/authorization checks on every mutation, no dead buttons or TODO placeholders left behind.

---

## 1. EXISTING TECH STACK (respect this - do not replace)

The project already uses (or is intended to use) this stack. Confirm what's actually in place during your audit, and only introduce a new tool if something below is a hard requirement that's genuinely missing:

- **Framework:** Next.js (App Router, Server Actions, Route Handlers)
- **Runtime:** Node.js
- **Language:** TypeScript, strict mode
- **Database:** SQLite, via a TypeScript ORM (Drizzle or Prisma - whichever is already set up in the project)
- **Auth:** Auth.js/NextAuth or equivalent already wired into the project
- **Real-time:** WebSockets (Socket.IO or native `ws`) - check if this exists yet; if the project only has request/response APIs so far, this is likely one of the biggest genuine gaps to fill, since chat, live notifications, typing indicators, and presence all depend on it.
- **Styling/UI:** Tailwind CSS + shared component library already in the project
- **Data fetching/state:** whatever server-state and client-state libraries are already configured (e.g. TanStack Query, Zustand) - keep using them consistently
- **Media storage:** check whether an upload/storage abstraction already exists; if uploads are missing or ad hoc, build a proper one (local disk now, swappable for S3-compatible storage later)
- **Background jobs:** check for any scheduled/queued task mechanism; if trending detection, moderation scans, or notification batching need one and none exists, add a lightweight one (e.g. a cron-driven table-based queue) rather than a heavy new dependency

---

## 2. GLOBAL UX REQUIREMENTS (audit every page against these, not just the "new" ones)

- Seamless navigation: Next.js App Router client-side transitions everywhere, no full page reloads, instant skeleton states on navigation, prefetching on hover/viewport-enter.
- Optimistic UI: likes, reactions, follows, comments, and messages must update instantly client-side and roll back gracefully on error.
- Persistent shell: navbar/sidebar/bottom tab bar should not fully unmount between page navigations.
- Real-time where it matters: new messages, read receipts, typing indicators, new notifications, and live like/comment counts on an open post must update without a manual refresh.
- Responsive, mobile-first on every page.
- Accessibility: keyboard navigation, visible focus states, ARIA labels, color contrast, reduced-motion support.
- Every list/feed needs a real empty state, error state (with retry), and loading skeleton - never a blank screen.

If any existing page fails one of these (e.g. a full reload on navigation, no loading skeleton, no empty state), treat that as a gap to close, not a cosmetic nice-to-have.

---

## 3. PAGE-BY-PAGE FEATURE CHECKLIST (audit each page against this list)

### 3.1 Home Feed
Confirm the page has, and complete whatever is missing:
- Navbar: logo, global search bar, nav icons (Home, Video/Reels, Groups, Messages, Notifications), profile menu (profile, settings, saved, activity log, dark mode toggle, logout).
- Stories tray: "Add to your story" first, then story rings ordered unseen-first, gradient ring for unseen / gray for seen.
- Post composer: text, multi-image upload, video upload, file attachment, poll creation, location tagging, feeling/activity tag, audience selector (Public/Followers/Private), hashtag auto-detection, @mention autocomplete.
- Smart feed with a visible toggle between "For You" (algorithmic, Section 7.1) and "Recent" (chronological).
- "People you may know" suggestions with mutual-friends count and one-click follow.
- Trending hashtags/topics module (Section 7.3).
- Active friends/online-now list with a quick message shortcut.
- Events/birthdays module.
- A clearly labeled, pluggable "Sponsored" slot woven into the feed.

Every post card must show/support:
- Author avatar, name, verified badge, relative timestamp, audience icon.
- Text (expandable "see more"), image gallery with lightbox, custom video player (autoplay-muted-on-scroll), file attachment chip, poll widget (vote + live results), location tag, clickable hashtags.
- Engagement bar: reaction mix + count, comment count, share count, view count.
- Reactions: 6 types (Like, Love, Haha, Wow, Sad, Angry) via hover/long-press picker, optimistic and real-time.
- Comment button opening the full comment system (Section 4.1).
- Share menu: Share Now (with quote), Share to Story, Send in Message, Copy Link.
- Save/bookmark toggle feeding the Saved page and collections.
- Overflow menu: Report (reason picker), Hide (with feedback), Copy link, Mute notifications for this post, Edit/Delete/Pin (author only).

### 3.2 Profile Page
Confirm/complete:
- Cover photo + profile picture upload/reposition/crop.
- Identity block: name, username, verified badge, bio, website, location, relationship status, join date.
- Stats row (Followers/Following/Friends) opening searchable list modals.
- About section: Education, Work/Experience, Skills, Languages, Interests, Location, Relationship - each independently addable/removable.
- Achievements/Badges shelf.
- Pinned posts (up to 3).
- Tabs: Timeline, Photos, Videos, Albums, Saved Posts (owner-only), Liked Posts (owner-only, privacy-gated), Comments, Friends List (with Mutual Friends on others' profiles), Groups, Events, Marketplace Listings.
- Actions on other users' profiles: Follow/Unfollow, Message, Block, Restrict, Report, Mute.
- Privacy-aware rendering for private accounts the viewer doesn't follow.

### 3.3 Messenger
Confirm/complete:
- Conversation list with search + filters (All/Unread/Pinned/Archived/Spam/Blocked), and per-row actions (pin, archive, mark unread, mute, delete, block/report).
- Chat window with grouped bubbles, date separators, group-chat avatars.
- Delivery states (Sending -> Sent -> Delivered -> Seen) and typing indicators, live via WebSockets.
- Online/last-seen status respecting privacy settings.
- Rich composer: emoji/GIF/sticker pickers, multi-image/video/file upload, voice message recording with waveform + playback.
- Voice/video call button and call UI (mute, camera toggle, end call, incoming-call screen) - WebRTC-based.
- Per-message actions: Reply, Forward, Delete (for me/everyone), Edit (with "edited" label), React, Copy.
- In-conversation message search with highlighted jump-to-result.
- Shared Media/Files/Links tab per conversation.
- New conversation / group creation with add/remove members and group info editing.

### 3.4 Notifications
Confirm/complete all types (Like, Comment, Mention, Reply, Follow, Friend Request, Story view/reaction, Birthday, Group invite, Event reminder, System, Achievement, Security alert), each with:
- Grouped actor avatars, relative time, read/unread state, deep link on click.
- Filters (All/Unread/Mentions/Follows/etc.), Mark all as read, per-item delete, real-time arrival with toast + badge update.
- Link into Settings > Notifications.

### 3.5 Search
Confirm/complete:
- Instant debounced suggestions (top users/posts/hashtags) while typing.
- Results page tabs: Top, People, Posts, Photos, Videos, Communities/Groups, Hashtags, Events, Pages.
- Filters (date, from friends/everyone, media type, location) and sorting (Relevant per Section 7.5 / Recent).
- Search history (clear individually or all) and a trending-searches module on focus.

### 3.6 Stories
Confirm/complete:
- Creation flow: Photo, Video (trim), Text-only (background/font styles), Music overlay, Location sticker, Poll sticker, Question sticker, Countdown sticker, @Mention sticker, GIF sticker, Emoji slider.
- Audience control: Public/Followers or Close Friends (dedicated list in settings).
- Viewer navigation exactly as follows - verify each behavior individually:
  - Tap right third -> next story/user. Tap left third -> previous.
  - Press-and-hold -> pause; release -> resume.
  - Swipe down -> close. Swipe up -> reply/sticker input.
  - Segmented progress bar auto-advancing per story duration.
  - Tapping a ring while viewing jumps to that user's stories.
- Reactions/replies sent as DMs into Messenger; mute a user's stories without unfollowing; report a story.
- Owner-only viewer list (recency-ordered, with reaction summary).
- Seen/unseen ring state and unseen-first tray ordering.
- 24h auto-archive to a private Story Archive.
- Highlights: save archived stories into named, reorderable, profile-pinned collections with custom covers.

### 3.7 Settings
Confirm/complete each sub-section fully wired to real data (not just UI):
- Account: name, email (re-verification), phone, username (availability check), password change, deactivate, delete (with export offer).
- Privacy: post audience default, who can friend/follow-request me, who sees my friends/email/phone/stories, hide online status, Blocked/Muted/Restricted user lists.
- Security: 2FA (TOTP + QR + recovery codes), Sessions list (per-session/all logout), Devices, Login History, Trusted Devices, Security Alerts toggle, regenerate recovery codes.
- Notifications: channel toggles (Push/Email/SMS/Desktop/In-app) x category (Likes/Comments/Follows/Messages/Mentions/Group/Reminders), Sound, Vibration.
- Appearance: Dark/Light/System, Language, Font size, Accessibility options, Theme accent color.

### 3.8 Activity Log
Confirm/complete: chronological, filterable, date-grouped record of Likes/Comments/Posts/Stories/Follows/Shares/Saves/Mentions, with per-entry delete.

### 3.9 Saved
Confirm/complete: unified saved posts/videos/photos/links view with type filters, plus user-created Collections/Folders with move/copy between them.

### 3.10 Communities / Groups
Confirm/complete: cover/name/description/privacy type/member count, Rules tab, Roles (Admin/Moderator/Member) with a real permissions model, content tabs (Posts/Events/Media/Files/Announcements/Polls/Live/Group Chat), join/request-to-join with approval queue, invite flow, moderation tools (pending-post approval, reported-content queue, remove/ban/mute member).

### 3.11 Admin Dashboard
Confirm/complete: overview metrics (users, DAU/WAU/MAU, posts, comments, pending reports, storage), ads/monetization panel, logs & analytics (system logs, growth/engagement/top-content charts sourced from real data), performance/infrastructure indicators, AI/moderation report queue with Approve/Remove/Warn actions, user management (search/suspend/ban/restore/verify), all behind real role-based access control.

---

## 4. POST & COMMENT INTERACTION LOGIC (audit each behavior individually - these are easy to half-implement)

### 4.1 Comments
- Threaded structure: top-level + nested replies (unlimited depth in the data model).
- Create with @mention autocomplete and emoji support.
- Reply: pre-fills "@username," nests under parent, with a "View N replies" collapse/expand.
- Edit: author-only, shows "(edited)."
- Delete: author/post-author/group-admin can delete; deleting a comment with replies shows a "This comment was deleted" placeholder while preserving the reply thread underneath (do not orphan or silently cascade-delete replies unless that is the behavior you find already implemented and intentional).
- React to a comment (thumbs-up + count), same optimistic/real-time behavior as post reactions.
- Report a comment (same reason picker as posts).
- Pin a comment (post author only).
- Sort: Most relevant (likes + recency + relationship) vs Newest first.

### 4.2 Post Reactions
- All 6 types (Like, Love, Haha, Wow, Sad, Angry) via hover/long-press picker; plain click toggles default Like/removes it.
- Engagement bar shows top 2-3 reaction types + total count; clicking opens a modal listing reactors, filterable by type.

### 4.3 Share
- Share Now (repost with optional quote, always linking to original), Share to Story (repositionable card), Send in Message (contact picker, rich preview card), Copy Link.
- All increment `shareCount` and reflect in real time for active viewers.

### 4.4 Hide / Report
- Hide: removes from that user's feed only, with "See fewer posts like this?" feedback wired into the recommendation engine (Section 7.2).
- Report: reason picker (Spam/Hate/Nudity/Violence/False info/Other + free text), queued into the Admin moderation panel, with repeated reports raising priority automatically.

---

## 5. MEDIA UPLOADS (audit across posts, stories, messages, profile/cover, group content)

- Image (jpg/png/webp/gif) and video (mp4/webm) upload with client-side size/type validation.
- Upload progress + cancel.
- Auto-generated video thumbnails.
- Multi-file selection, drag-and-drop, paste-from-clipboard in composers.
- Images served in at least two sizes (full + thumbnail).

If uploads currently only support one file type or one page (e.g. posts but not messages), that's a gap - bring every upload surface up to this same standard.

---

## 6. SMOOTH NAVIGATION & PERFORMANCE (verify, don't just assume)

- No full white flash between routes - Suspense boundaries with real skeleton fallbacks.
- Cursor-based (not offset-based) pagination on every infinite-scroll feed.
- Prefetch next feed page before the user hits the bottom.
- Responsive, lazy-loaded images below the fold.
- Short-TTL in-memory caching on read-heavy queries (profile headers, feed pages), invalidated precisely on relevant writes.
- Every mutation feels instant client-side (optimistic), regardless of real network latency.

---

## 7. INTELLIGENT SYSTEMS - THE "ALGORITHM" LAYER (these are the most likely to be missing or stubbed - audit carefully)

### 7.1 Smart Feed Ranking
`score = w1*recencyDecay + w2*log(1+likes) + w3*log(1+comments) + w4*relationshipStrength + w5*mediaBonus`, where relationshipStrength comes from the viewer's interaction history with that author. If the current feed is just `ORDER BY createdAt DESC` with no ranking and no For You/Recent toggle, this is a real gap - implement it.

### 7.2 Recommendation Engine
Blend collaborative signals (mutual-follow graph traversal) with content-based signals (shared hashtags/interests). Wire "Hide"/"See fewer like this" feedback (4.4) back into it.

### 7.3 Trending Detection
Scheduled engagement-velocity scoring per hashtag/topic (`velocity = engagementInLastWindow / engagementInPriorWindow`), not just raw counts.

### 7.4 Content Moderation
Automated checks (banned-word/phrase list, spam-pattern/rate-limit detection) on new posts/comments/messages, auto-blocking obvious violations and queuing borderline content into the Admin moderation panel alongside user reports. Build as a pluggable interface for a future real ML moderation API.

### 7.5 Search Ranking
Relevance score blending text-match quality, engagement, recency, and relationship - not alphabetical/chronological order.

### 7.6 Notification Prioritization & Smart Caching
Group/batch low-priority notifications (e.g. "12 people liked your photo"), prioritize by relationship strength/engagement. Pair with precise cache invalidation on the writes that affect cached feed/notification data.

### 7.7 Real-Time Updates
New message, read receipt, typing indicator, new notification, live like/comment count on an open post, and online/offline presence - all via WebSockets, not refresh-to-see.

### 7.8 Analytics System
Real internal events table (page views, post created, like, comment, share, session start/end) feeding the Admin Dashboard's charts - not hardcoded numbers.

---

## 8. AUDIT & COMPLETION PLAN (work through these areas in order; do not skip ahead)

For **each** area below, follow this exact loop:
1. **Audit** the relevant pages/components/server actions/schema against the checklist for that area (Sections above).
2. **Report** a short list: what's ✅ already working, what's ⚠️ partial, what's ❌ missing.
3. **Implement** only the ⚠️ and ❌ items, matching the existing codebase's conventions.
4. **Verify** using the Section 9 quality gate before moving to the next area.

**Area 1 - Foundation check:** project structure, DB schema completeness against every entity implied by Sections 3-7 (users, posts, comments, reactions, stories, messages, notifications, groups, etc.), auth/session setup, WebSocket infrastructure presence.

**Area 2 - Profile & Social Graph:** Section 3.2 in full, plus follow/block/restrict logic.

**Area 3 - Home Feed & Post Core:** Section 3.1 shell + basic post CRUD + basic like/comment.

**Area 4 - Full Post Interactions:** Section 4 in full (reactions, threaded comments, share, save, hide/report, polls, hashtags, view counts).

**Area 5 - Stories:** Section 3.6 in full, including exact viewer navigation behavior.

**Area 6 - Messenger:** Section 3.3 in full, including real-time delivery/typing/calls.

**Area 7 - Notifications:** Section 3.4 in full, real-time delivery.

**Area 8 - Search:** Section 3.5 in full.

**Area 9 - Settings:** Section 3.7, all five sub-sections, wired to real enforcement elsewhere in the app.

**Area 10 - Activity Log & Saved Collections:** Sections 3.8-3.9.

**Area 11 - Communities/Groups:** Section 3.10 in full.

**Area 12 - Admin Dashboard:** Section 3.11 in full.

**Area 13 - Intelligent Systems:** Section 7 in full, wired into the feed/search/notifications/moderation built in earlier areas.

**Area 14 - Navigation, Performance & Final QA:** Section 6 in full, plus a final pass confirming every checklist item across this entire document is genuinely ✅.

---

## 9. PER-AREA QUALITY GATE (repeat after finishing each area in Section 8)

- [ ] Audit report for this area was produced and shared (✅/⚠️/❌ per feature).
- [ ] Every ⚠️ and ❌ item for this area has been implemented to spec.
- [ ] `npm run build` (or the project's equivalent) completes with zero errors.
- [ ] Nothing that was ✅ before this area started is now broken (regression check).
- [ ] New/changed pages have loading, empty, and error states.
- [ ] Mobile layout verified, not just desktop.
- [ ] Any new DB columns/tables have a proper migration.
- [ ] Every new/changed mutation checks authentication and authorization.

---

## 10. FINAL GOAL

By the end of Area 14, every single feature described in Sections 3-7 of this document must be genuinely present and working in the live app - confirmed via the audit reports, not assumed. Where the current app and this document disagree, this document is the target: keep auditing and closing gaps, one area at a time, until they match completely.
