# Fix & Elevate Prompt - "Tera" Social Platform
### Bug fixes + best-in-class UX upgrades (better than Facebook/Instagram/Twitter/LinkedIn/YouTube combined)

---

## 0. META-INSTRUCTIONS FOR THE AI (READ FIRST)

This is an **existing, live codebase** with real bugs reported by real usage. Your job:

1. **Root-cause every bug before patching it.** Don't mask a symptom (e.g. wrapping something in a try/catch to hide an error) - find and fix why it's actually broken.
2. **Fix issues ONE AT A TIME, in the order listed below.** After each fix: test it manually end-to-end, confirm you didn't break anything else in the app, then move to the next issue. Do not attempt all 7 fixes in one giant pass.
3. **Don't just meet the minimum bug-fix bar - implement the "Required Fix" behavior described for each issue.** These descriptions intentionally go beyond a bare fix and specify the best-in-class version of that feature, combining the strongest patterns from Facebook, Instagram, Twitter/X, LinkedIn, and YouTube, and in a few places deliberately improving on all of them. That upgraded version is the actual target, not just "make the error go away."
4. **Preserve everything already working.** These are targeted fixes/upgrades to specific parts of the app, not a rewrite.
5. **After each issue is fixed**, produce a short note: what was actually broken (root cause), what you changed, and confirmation the acceptance criteria for that issue are met.

---

## ISSUE 1 - Copied post links show "Page Not Found"

**Problem:** Copying a post's link via "Copy Link" and opening it in a browser shows a not-found/error page instead of the post.

**Root cause checklist (check all of these):**
- Is there actually a route for viewing a single post by ID (e.g. `/post/[postId]`)? If it doesn't exist yet, that's the main gap.
- Does the "Copy Link" button build the URL correctly using the real origin and the correct post ID (not a placeholder, a stale ID, or a malformed path)?
- Does the page's data-loading logic query the post correctly, or is it throwing a not-found error even for valid IDs due to a query/typing bug?
- Is a *visibility* check (private/followers-only post) incorrectly triggering a generic 404 instead of a proper "this post is private" state?

**Required fix (target behavior):**
- Build a proper `/post/[postId]` page that server-renders the post using the **exact same post card component used in the Home Feed**, so it looks and behaves identically (same reactions, comments, share, repost, save, overflow menu - everything from the rest of this document) - not a stripped-down "detail view."
- Below the opened post, continue rendering the normal feed (infinite scroll, same ranking logic) so the user can keep scrolling and browsing other posts naturally, exactly as if they'd landed on the home feed with this one post pinned at the top. This is better than most platforms, where a permalink is a dead-end page.
- "Copy Link" must generate the real, absolute canonical URL (`{origin}/post/{id}`), copy it to the clipboard, and show a "Link copied" toast confirmation.
- Add proper Open Graph meta tags (title, description excerpt, image) on this page so links shared into Messenger/WhatsApp/iMessage/Twitter render a rich preview card - matching what major platforms do.
- Only show a genuine "Post not found" state for posts that are actually deleted or never existed. For a private post the viewer isn't allowed to see, show a distinct "This post is private" message instead of a generic 404.

**Acceptance criteria:**
- [ ] Copying any post's link and opening it (including in a fresh/incognito session) opens that exact post, styled like the feed.
- [ ] Scrolling below the opened post shows more posts and keeps loading (infinite scroll), not a dead end.
- [ ] All post actions (like, comment, share, repost, save, report) work identically on this page as in the feed.
- [ ] A deleted/nonexistent post ID shows a clean "Post not found" page; a private post the viewer can't access shows a "This post is private" message.
- [ ] Shared links preview correctly with title/image where the receiving app supports link previews.

---

## ISSUE 2 - Uploaded videos don't play; add a professional "Watch" page

**Problem:** When a video is uploaded, trying to open/play it does nothing.

**Root cause checklist:**
- Is the video file actually saved correctly (valid file, correct extension/MIME type) by the upload handler?
- Is the route/handler serving the video file setting the correct `Content-Type`, and - critically - does it support **HTTP Range requests** (returning `206 Partial Content`)? Most browsers require Range support to play video at all, and it's required for seeking.
- Does the `<video>` element's `src` point to a real, reachable URL (not a temporary local path, a revoked blob URL, or a broken relative path)?
- Any CORS issues if media is served from a different origin/path than the page?
- Is the player component itself broken (wrong `type` attribute, missing `controls`, autoplay being silently blocked by the browser with no fallback UI shown to the user)?

**Required fix (target behavior):**
- Fix/build the media-serving endpoint so it correctly streams video with full Range-request support, enabling instant playback start and smooth seeking on all major browsers and mobile.
- Build one shared, custom video player component (used everywhere video appears: feed, Watch page, stories, profile Videos tab) with: play/pause, a seek bar showing buffered progress, volume/mute control, playback-speed control, fullscreen, picture-in-picture, an auto-generated poster/thumbnail shown before playback starts, a loading/buffering spinner, and a clear inline error state ("This video couldn't be played" + Retry button) instead of a silently dead player.
- Build a dedicated **Watch** page, combining the best of Facebook Watch and YouTube: a large primary player, video title, uploader's avatar/name with a follow button, the engagement bar (reactions/comments/share/repost) beneath it, and a "More videos" rail (sidebar on desktop, below the player on mobile) that autoplays the next video when the current one ends, with infinite scroll through the video catalog. Add a persistent mini/floating player (picture-in-picture style) that keeps a video playing in a small corner window if the user navigates elsewhere in the app while it's playing - a real improvement over baseline platforms, most of which stop playback on navigation.
- Every video thumbnail anywhere in the app (feed, profile, Watch rail) must link into this same consistent player experience.

**Acceptance criteria:**
- [ ] A freshly uploaded video plays immediately when clicked, from feed, profile, or the Watch page.
- [ ] Seeking works smoothly (drag the progress bar to any point).
- [ ] The Watch page lists videos, autoplays the next one, and the "More videos" rail is populated and playable.
- [ ] Navigating away from a playing video shows the floating mini-player rather than silently killing playback.
- [ ] A genuinely broken/corrupted video shows the inline error + retry state instead of an unresponsive player.

---

## ISSUE 3 - Comments should open in a full overlay, not navigate away

**Problem:** Clicking comments on a post should show the post and its comments together in a large overlay box on top of the whole page, so the feed stays intact underneath.

**Required fix (target behavior):**
- Clicking "Comment" on any post (in the feed, on the Watch page, or on the post's own permalink page) opens a modal that takes over the viewport (Instagram-style): the post's media/content on one side (or on top, on mobile) and the full comment thread + comment composer on the other side (or below on mobile), with the background dimmed behind it.
- The modal is dismissible via an explicit close (X) button, clicking the dimmed background, or pressing Esc, and closing it returns the user to the **exact scroll position** they were at in the feed - no jump to the top, no reload.
- The full comment system already specified elsewhere (nested replies, edit, delete-with-placeholder, react to a comment, pin, sort by relevant/newest) must work completely inside this overlay without needing to leave it.
- On mobile, render this as a full-screen sheet (slides up from the bottom) instead of a centered desktop modal, but with the same close behavior.
- Optionally (recommended): update the URL when the overlay opens (e.g. `?comments={postId}`) so the comment view is itself linkable/shareable and the browser back button closes it naturally, without breaking normal navigation elsewhere in the app.

**Acceptance criteria:**
- [ ] Clicking Comment never navigates away from the current page - it always opens the overlay in place.
- [ ] The overlay shows the post and its comments together, fully functional (posting, replying, editing, deleting, reacting, pinning, sorting).
- [ ] Closing the overlay returns to the exact previous scroll position.
- [ ] Behavior is identical whether triggered from the Home Feed, a Profile timeline, the Watch page, or the post's own permalink page.

---

## ISSUE 4 - See who reacted, grouped by reaction type

**Problem:** Need to be able to click on the reactions shown on a post and see exactly who reacted.

**Required fix (target behavior):**
- Clicking the reaction summary (the icon stack + count) on any post opens a modal listing everyone who reacted, with filter tabs across the top: "All" plus one tab per reaction type actually present on that post (e.g. All · 👍 Like 96 · ❤️ Love 20 · 😂 Haha 12), each tab showing the accurate count.
- Each row in the list shows the reactor's avatar and name, and - as an improvement over baseline platforms - a quick "Follow" button inline if the viewer doesn't already follow that person.
- The list must be paginated or virtualized so posts with hundreds or thousands of reactions still open and scroll smoothly without freezing the UI.
- If new reactions come in while the modal is open, the list and counts should update live (real-time), not require reopening the modal.

**Acceptance criteria:**
- [ ] Clicking the reaction summary on any post opens the modal instantly.
- [ ] Tabs correctly filter by reaction type and counts match the engagement bar exactly.
- [ ] Tested on a post with a very large number of reactions without performance issues.
- [ ] New reactions appearing while the modal is open update the list live.

---

## ISSUE 5 - Add a Repost button to every post

**Required fix (target behavior):**
- Add a distinct **Repost** action (separate from Like/Comment/Share, its own icon - two looping arrows) on every post's action bar.
- Clicking it instantly and optimistically marks the post as reposted by the current user, changing the button's visual state and label to "Reposted" (and clicking again un-reposts it, same optimistic behavior).
- A repost creates a lightweight reference record (it does **not** duplicate the original post's content). It appears on the reposting user's profile timeline and in their followers' feeds with a clear attribution header above the original content, e.g. "🔁 [Name] reposted," while the original author's name, media, and engagement counts (likes/comments/reposts) remain the single source of truth and are not duplicated or split across copies.
- Support an optional **Quote Repost**: the user can add their own comment/caption on top of the repost, shown above the embedded original post.
- Reconcile this with the existing Share menu (Issue 6): the Share sheet's "Share Now / Share Now with a quote" option and this new Repost/Quote-Repost button should be the **same underlying feature** presented from two entry points, not two separate, competing systems. Whichever entry point the user starts from, the result and the data model should be identical.

**Acceptance criteria:**
- [ ] The Repost button is present, and clicking it is instant and reversible.
- [ ] Reposted content shows correct attribution and links back to the original post/author.
- [ ] The original post's engagement numbers stay accurate everywhere (not duplicated by reposts).
- [ ] Quote Repost lets the user add a caption and displays it correctly above the embedded original.
- [ ] The Share sheet's own repost/quote option and the standalone Repost button produce identical, consistent results.

---

## ISSUE 6 - Share button should open a proper share sheet with options

**Required fix (target behavior):**
Clicking Share on any post opens a menu/sheet containing:
- **Copy Link** - copies the permalink from Issue 1's fix, with a "Link copied" toast.
- **Send in Message** - opens a searchable contact/conversation picker (search by name, multi-select to send to several people/conversations in one go); sends the post as a rich preview card (thumbnail + author name + text snippet) directly into the chosen conversation(s), delivered in real time and visible immediately in the recipient's chat, with a confirmation toast (e.g. "Sent to Sara, Ahmed").
- **Share to Story** - as previously specified, lets the user place the post as a resizable card onto their own story.
- **Repost / Quote Repost** - reusing the exact system from Issue 5, so all "share this further" actions live in one consistent, discoverable place instead of being scattered across the UI.
- On mobile, when available, also offer the native OS share sheet (Web Share API) as an extra option, so users can share outside the platform entirely (WhatsApp, SMS, Twitter, etc.) - a genuine advantage most closed platforms don't offer.

**Acceptance criteria:**
- [ ] Every option in the share sheet works end-to-end, not just visually.
- [ ] "Send in Message" actually delivers a working message with a post preview, visible in real time in the recipient's conversation.
- [ ] The sheet is available and consistent everywhere Share appears (Home Feed, Watch page, Profile, post permalink page).
- [ ] On supported mobile browsers, the native share sheet option appears and works.

---

## ISSUE 7 - Reporting must reach a real admin moderation queue with working actions

**Required fix (target behavior):**
- Reporting a post opens a reason picker: Spam, Hate speech/Harassment, Nudity/Sexual content, Violence, False information, Other (with an optional free-text details field).
- Submitting creates a report record linking: reporter, reported post, reported post's author, reason(s), optional details, timestamp, and status (pending/resolved). Prevent the same user from submitting multiple duplicate reports on the same post - if they try again, show "You've already reported this post."
- If a post receives reports from multiple different users, aggregate them into a single queue entry showing the total report count and every reason given, and raise that post's priority in the queue as reports accumulate - not a flat, unordered list.
- The Admin Dashboard's moderation queue must display, for every pending report: the **actual reported post rendered in full** (so the admin can see exactly what was posted, not just a link or an ID), who reported it and why, and when.
- Admin actions, each fully functional and immediately effective:
  - **Delete the post** - permanently removes the post and its media; resolves the report(s).
  - **Ban the user** - suspends the author's account so they can no longer access the platform normally (shown a "Your account has been suspended" state on login attempt); resolves the report(s).
  - **Mute the user** - a lighter, time-boxed action: the user keeps normal access (browsing, liking, commenting, messaging) but is blocked from creating new posts, stories, or comments for a duration the admin sets (e.g. 24 hours / 7 days / 30 days / indefinite), and sees a clear in-app explanation of the restriction and when it lifts. Automatically lift the mute when the duration expires, and allow an admin to lift it early.
  - **Dismiss** - closes the report with no action taken, for reports found to be invalid, so admins aren't forced to punish content that didn't violate anything.
- Log every admin action (who did what, to whom, when, and the outcome) into a visible audit log in the Admin Dashboard.

**Acceptance criteria:**
- [ ] Reporting a post creates a real entry visible in the Admin Dashboard's moderation queue.
- [ ] The admin can see the full post content inline while reviewing, plus reporter and reason info, with multi-report aggregation working.
- [ ] Delete, Ban, Mute, and Dismiss each produce their exact described effect when tested.
- [ ] A muted user genuinely cannot create new posts/stories/comments while muted, sees a clear explanation, and the mute lifts automatically after its duration (or early if an admin lifts it).
- [ ] Every admin action appears in the audit log.

---

## FIX ORDER (work strictly in this sequence)

1. Issue 1 (broken permalinks) - this blocks proper testing of Issues 3 and 6, since both rely on a working post detail context.
2. Issue 2 (video playback + Watch page) - independent, but foundational for a good user experience.
3. Issue 3 (comments overlay) - depends on Issue 1 being fixed for full consistency across entry points.
4. Issue 4 (reactions-by-type modal) - independent, quick to verify.
5. Issue 5 (Repost button) - build this before Issue 6, since Issue 6 reuses it.
6. Issue 6 (share sheet) - depends on Issues 1 and 5 being done first.
7. Issue 7 (report -> admin moderation) - independent, do last since it touches the Admin Dashboard broadly.

After each issue, confirm its acceptance criteria fully before starting the next one. Do not move on with a criteria box unchecked.

---

## FINAL QUALITY GATE (after all 7 issues are fixed)

- [ ] All 7 issues individually verified against their acceptance criteria above.
- [ ] Full regression pass: Home Feed, Profile, Messenger, Notifications, Search, Stories, Settings, Groups, and Admin Dashboard all still work as before.
- [ ] `npm run build` completes with zero errors.
- [ ] Mobile and desktop both verified for every changed area.
- [ ] Short written summary per issue: root cause found, fix applied, and confirmation it now matches the "Required Fix" behavior described above (not just a minimal patch).
