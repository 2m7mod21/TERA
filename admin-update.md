# Admin Panel Master Prompt - "TERA" Social Platform

### Full-featured, fast-at-scale, professionally designed control center

\---

## 0\. META-INSTRUCTIONS FOR THE AI (READ FIRST)

1. **Existing codebase.** A basic Admin Dashboard may already exist from earlier work (overview metrics, a moderation queue). **Audit it first.** Confirm exactly what exists, what's partial, and what's missing against the full specification below (Section 3). Complete/expand what's there; build what isn't. Nothing below is optional - if a listed section or action is missing from the app, add it.
2. **This is a large surface area. Build it in the phased order given in Section 5**, not all at once. Verify each phase (Section 7) before starting the next.
3. **Role-based access control (RBAC) is the backbone of this entire panel**, not just one section of it (Section 3.14). Every single action in every section below must check the acting admin's role/permissions before executing - not just the sections that obviously look sensitive.
4. **Every mutating admin action, in every section, must write to the Audit Log (Section 3.17)** - not just the ones explicitly labeled "moderation." Deleting a post, editing platform settings, changing a user's status, sending a mass notification, editing an ad campaign - all of it gets logged: who, what, on what target, old value → new value where relevant, and when.
5. **This panel will be used against a platform with potentially tens of millions of rows of data** (as reflected in the example numbers below). Every list/table in this panel must be built for that scale from day one - see Section 4 (Performance \& Scale) - not retrofitted later.
6. **Visual design must be light, clean, and professional** - see Section 6 (Design Direction) for concrete requirements. This is a tool admins will live in for hours; it must feel calm and fast, not heavy or cluttered.
7. **After finishing each phase**, report exactly what was found during the audit (✅ existed / ⚠️ partial / ❌ missing) for that phase's sections, confirm what you built/completed, and confirm the Section 7 quality gate passes before moving on.

\---

## 1\. TECH \& ARCHITECTURE NOTES (respect the platform's existing stack)

* Built on the platform's existing Next.js + Node.js + SQLite stack. Do not introduce a parallel stack for the admin panel.
* The admin panel should live under its own route group (e.g. `/admin/\*`) with its own layout, protected end-to-end by an admin-role check in middleware **and** re-checked in every individual server action/route handler (never trust the route guard alone).
* Because SQLite is a single-writer database, any heavy aggregate query (e.g. total counts across tens of millions of rows) must **not** be computed live on every dashboard load - see Section 4 for the required rolling-counters/caching approach.
* Code-split the admin panel from the main user-facing app bundle - regular users should never download admin panel code.

\---

## 2\. ROLE MODEL (build this first - everything else depends on it)

Implement the role hierarchy from Section 3.14 as real, enforced permissions, not just labels:

* **Owner** - full access to everything, including Database Management and irreversible platform settings.
* **Super Admin** - full access except the most destructive Owner-only actions (e.g. raw database tools, deleting other Super Admins).
* **Moderator** - Reports, Moderation, Content Management actions only (e.g. can delete posts, handle reports) - explicitly **cannot** delete/ban user accounts or touch Settings/Database/Ads.
* **Support** - Support Center + read-only user lookup, cannot moderate content or change platform settings.
* **Analyst** - read-only access to Analytics and Dashboard, no mutating actions anywhere.
Each role's exact permission matrix must be stored as real data (a permissions table), editable by Owner/Super Admin in Section 3.14's UI, not hardcoded `if (role === 'moderator')` checks scattered through the code - centralize the permission check into one reusable authorization utility used everywhere in this panel.

\---

## 3\. SECTION-BY-SECTION SPECIFICATION (every item below must be present and fully functional)

### 3.1 Dashboard

The landing page of the panel. Must show, live/near-live (see Section 4 for how to make this fast at scale):

* Total Users, Active/Online Users right now, New Users (today/this week/this month), Total Posts, Total Comments, Total Likes, Total Messages, Total Pending Reports - each as a clear stat card with a trend indicator (up/down vs. the previous period).
* A compact activity chart (e.g. signups or posts per day over the last 30 days).
* A "needs attention" panel surfacing the highest-priority pending reports and any active security alerts, so an admin logging in immediately sees what matters most, not just raw numbers.
* All numbers must be genuinely sourced from the database (via the caching strategy in Section 4), never hardcoded placeholders.

### 3.2 User Management

The most-used section. Must include:

* A searchable, filterable, paginated table of all users showing: ID, Name, Username, Email, Phone, Registration date, Last seen, Follower count, Account status.
* Filters: account status (Active/Suspended/Banned/Deleted/Verified), registration date range, search by name/username/email/phone.
* Per-user admin actions: View full account (as admin, read-only preview of their profile/content), Edit user data, Change name, Change profile photo, Deactivate account, Delete account (with confirmation), Ban account (with a required reason, tied into the moderation system built earlier), Verify account (grant the blue badge directly, separate from the request flow in 3.3).
* Bulk actions where sensible (e.g. select multiple flagged accounts and suspend them together), gated by role.
* Every action here writes to the Audit Log.

### 3.3 Verification Management (blue badge requests)

* Three tabs/filters: New requests, Approved, Rejected.
* Each request shows: real name submitted, ID/document upload(s) (viewable securely), stated reason for the request, and a link to the actual public profile being verified.
* Actions: Approve (flips the account's verified flag and notifies the user), Reject (with an optional reason sent to the user), and the ability to revisit/revoke a previously approved verification if needed.

### 3.4 Content Management

* A unified, filterable table of all content (Posts, Images, Videos, Reels/short-video, Stories, Live sessions if implemented) with search and filters by content type, date, and author.
* Actions per item: Delete post, Hide post (soft-hide, reversible), Pin post (platform-level pinned/featured content, distinct from a user's own profile pin), Review (opens the full content inline for the admin to inspect before acting, reusing the actual post-rendering component from the main app so admins see exactly what users see).

### 3.5 Reports \& Moderation

This extends the report-handling system built earlier into its full admin surface:

* A queue of reports, each showing: report ID, what was reported (post/comment/user/message), the reason category, current status (Pending/Reviewed/Resolved), and - critically - **the actual reported content rendered inline**, not just a link or ID, so the admin can judge it directly.
* Multiple reports on the same content must be aggregated into one queue entry with a total count and every reason listed, sorted with higher-report-count/higher-severity items surfaced first.
* Admin actions per report: View the content, View the reported account, Accept the report (and then choose a consequence), Reject the report (dismiss, no action), Delete the content, Warn the user (sends a formal in-app warning, logged on their account), Suspend the account.
* This section must share its underlying data model with the report system specified in the earlier "Fix \& Elevate" prompt - do not build a second, separate reporting system.

### 3.6 AI Moderation

* An automated scanning layer that evaluates new posts/comments/images/videos for hate speech, profanity/harassment, disallowed imagery, disallowed video content, and spam patterns (reusing the pluggable moderation interface specified in the platform's core algorithm/moderation work).
* Each flagged item shows a **Risk Score** (e.g. 0-100%) and the specific reason category the automated check triggered (e.g. "Violent content," "Spam pattern," "Hate speech").
* Flagged items above a configurable risk threshold route automatically into the Section 3.5 moderation queue for human review, sorted with the highest risk scores first; items below the threshold can be auto-logged for audit purposes without necessarily blocking anything.
* The risk threshold itself should be admin-configurable (ties into the platform's broader configurable-weights philosophy from the algorithm work).

### 3.7 Messages Management

* Aggregate, non-content statistics only by default: total message volume, reported conversations/messages, detected spam patterns, delivery/error rates.
* Admin access to actual private message *content* must be restricted and explicit - only reachable through a specific, logged "Investigate reported conversation" flow tied to an actual user report or a legal request, never general browsing of users' private messages. Log every instance of an admin viewing message content, including which admin, when, and which report/case justified it.

### 3.8 Analytics

A proper analytics suite, organized into clear tabs:

* **Users:** daily signups (chart), geographic breakdown (country), age-range breakdown (if collected), activity/retention trends.
* **Content:** most-viral posts (by engagement velocity, reusing the Trending logic from the core algorithm), most-influential accounts (by follower growth/engagement), aggregate time-spent-on-platform metrics.
* **Performance:** API response-time trends, error rates, and basic server/infrastructure indicators (ties into Section 3.16).
All charts must be backed by the real internal analytics events table specified in the platform's core algorithm work - not hardcoded sample data.

### 3.9 Monetization

* Revenue dashboard: today's revenue, revenue trends over time, active ad count, active subscriptions/paid-feature counts if implemented.
* Manage: ad campaigns' billing status, creator monetization payouts (tipping/subscriptions from the core platform spec), payment/transaction history with search and export.
* Where real payment processing isn't wired up yet, build this against realistic internal data structures (clearly noted as such) so it's a genuine, correctly-shaped feature ready to connect to a real payment processor later - not a page of fake numbers.

### 3.10 Ads Manager

Modeled on a Facebook-Ads-style review flow:

* Queue of submitted ad campaigns awaiting review, each showing the actual ad creative, target audience settings, budget, and duration.
* Actions: Approve, Reject (with reason), Pause an active campaign, view real-time spend tracking against budget for active campaigns.

### 3.11 Platform Settings

Global, site-wide configuration, organized into clear groups:

* **Site identity:** platform name, logo upload, primary/accent color tokens, custom domain configuration.
* **Registration:** toggle whether new signups are allowed at all, allow/disallow email-based registration, allow/disallow phone-based registration.
* **Content rules:** maximum post length, maximum image size/dimensions, maximum video size/duration, maximum hashtags per post - all enforced platform-wide the moment they're changed here, not just displayed as numbers.
Every setting change here is high-impact - require confirmation on save and always write to the Audit Log.

### 3.12 Notification Management (mass notifications)

* A composer for sending platform-wide or segmented notifications: Title, Body, and a Target selector (All Users / a filtered segment such as "Verified users" or "Users inactive 30+ days," reusing the same filter logic as User Management where possible).
* Send immediately or schedule for later; show delivery status/progress for large sends (this can be a background job, given SQLite's constraints - don't block the admin UI on a mass-send to millions of users).
* A history log of previously sent mass notifications with their reach/open stats if available.

### 3.13 Security Center

Platform-wide security visibility (distinct from the per-user security settings built in the core platform spec - this is the admin's view across everyone):

* Suspicious login attempts (failed logins, unusual-location logins) across the platform, with the ability to drill into a specific account's history.
* IP blocking: a managed list of blocked IP addresses/ranges, with add/remove controls.
* A cross-account view of active devices/sessions for security investigations, with the ability to force-terminate any session.

### 3.14 Admin Management

* Manage the admin team itself: list of admins with their assigned role (Owner/Super Admin/Moderator/Support/Analyst), invite a new admin, change an existing admin's role, remove an admin.
* The permission matrix per role (Section 2) is editable here by Owner/Super Admin, showing exactly what each role can and cannot do (e.g. clearly display "Moderator: ✓ Delete Posts, ✓ Handle Reports, ✗ Delete Users" style capability lists), and changes here take effect immediately across the whole panel.

### 3.15 Database Management

**Owner/developer-only**, with extra safety guardrails given how destructive this section can be:

* View table structures and row counts (read-only browsing, not an open SQL console by default).
* Trigger and download backups.
* View/run pending migrations with a clear diff of what will change before confirming.
* View recent database-related logs/errors.
* Any destructive action here (e.g. running a migration) requires an explicit confirmation step and is always audit-logged with full detail.

### 3.16 System Monitoring

Real infrastructure visibility, sourced from actual metrics wherever the environment allows it (not decorative numbers):

* CPU/RAM usage of the Node.js process, current SQLite database file size, and disk/storage usage.
* API uptime/health indicator and recent response-time trend.
* Any background job queue status (e.g. the trending-recalculation or notification-batching jobs from the core platform spec) - queued/running/failed counts.
Where a true metric genuinely isn't available in this environment (e.g. real Redis/multi-server metrics if the platform doesn't use them), clearly label it as such rather than faking a number.

### 3.17 Audit Logs

* A complete, searchable, filterable log of every admin action taken anywhere in this panel: acting admin, action type, target (e.g. "Post #55342"), timestamp, and old→new values where relevant (e.g. a settings change or a role change).
* Filters by admin, action type, date range, and target type.
* This section is the verification backbone for the rest of the panel (Section 7) - if an action doesn't show up here, it wasn't actually implemented to spec.

### 3.18 Support Center

* A ticketing view: incoming user support tickets/issue reports, with status (Open/In Progress/Resolved), assignment to a specific admin, and an in-panel reply thread per ticket.
* Basic ticket filtering (status, date, assigned admin) and search.

\---

## 4\. PERFORMANCE \& SCALE REQUIREMENTS (mandatory for every list/table above)

This panel must stay fast even when the platform has millions of rows of data:

* **Never compute large aggregate counts live on every page load.** Maintain rolling counter tables/cached aggregates (e.g. a `platform\_stats` table updated incrementally by triggers or background jobs) for the Dashboard's headline numbers, refreshed on a short interval - not a live `SELECT COUNT(\*)` over the full users/posts table on every visit.
* **Every table (Users, Content, Reports, Audit Logs, etc.) uses server-side, cursor-based pagination** - never load and filter an entire table client-side.
* **Server-side search and filtering**, hitting properly indexed columns (username, email, status, dates) - add the necessary database indexes.
* **Virtualize long lists/tables** on the frontend (render only visible rows) so scrolling through large result sets stays smooth.
* **Debounce all search inputs** so typing doesn't fire a query per keystroke.
* **Code-split each admin section** so navigating between, say, Analytics and Database Management doesn't load unrelated code.
* **Cache read-heavy, slow-changing panels** (e.g. Analytics charts) with a short TTL and background refresh rather than recomputing on every view.

\---

## 5\. PHASED BUILD PLAN (build strictly in this order)

**Phase 0 - Role Foundation:** Section 2's role model and the centralized authorization utility, plus the admin route group/layout shell. Everything else depends on this being correct first.

**Phase 1 - Dashboard + Analytics Data Pipeline:** Section 3.1 and the underlying rolling-counters/caching infrastructure from Section 4 (build this pipeline once, reuse it for 3.8 later).

**Phase 2 - User Management + Verification Management:** Sections 3.2 and 3.3.

**Phase 3 - Content Management + Reports \& Moderation + AI Moderation:** Sections 3.4, 3.5, 3.6 together, since they're tightly coupled (content review flows directly into moderation actions).

**Phase 4 - Messages Management (admin oversight only):** Section 3.7, with the strict access-logging requirement built in from the start, not added later.

**Phase 5 - Analytics (full build-out):** Section 3.8, using the Phase 1 data pipeline.

**Phase 6 - Monetization + Ads Manager:** Sections 3.9 and 3.10.

**Phase 7 - Platform Settings + Notification Management:** Sections 3.11 and 3.12.

**Phase 8 - Security Center + Admin Management:** Sections 3.13 and 3.14 (Admin Management's role-editing UI now has the Phase 0 foundation to actually control).

**Phase 9 - Database Management + System Monitoring:** Sections 3.15 and 3.16, Owner/developer-only.

**Phase 10 - Audit Logs + Support Center:** Section 3.17 (retroactively verify every prior phase's actions are actually appearing here) and Section 3.18.

**Phase 11 - Performance Pass:** apply every requirement in Section 4 across all sections built so far, with real large-dataset testing (see Section 7).

**Phase 12 - Design Polish Pass:** apply Section 6 consistently across every section, fix any visual inconsistency between phases built at different times.

\---

## 6\. DESIGN DIRECTION (light, clean, professional - not heavy or cluttered)

* **Overall feel:** calm, minimal, data-dense but never cramped - closer to Linear/Stripe/Vercel-style dashboards than a busy, icon-heavy admin template.
* **Whitespace over decoration:** generous spacing between sections; use subtle 1px borders/dividers to separate content instead of heavy drop shadows or thick card outlines.
* **Restrained color palette:** a neutral base (whites/grays, with a proper dark-mode neutral scale too) plus one clear accent color for primary actions, and a small, consistent set of semantic colors for status badges (e.g. green = active/healthy/approved, amber = pending/warning, red = banned/critical/error, blue = informational) used identically everywhere in the panel.
* **Typography:** a clear hierarchy (page titles, section headers, table headers, body text) with a legible, professional typeface; numbers in stat cards should be visually prominent but not oversized/gaudy.
* **Tables:** clean row separators, comfortable row height, sticky headers on scroll, right-aligned numeric columns, hover state on rows, and consistent action-icon placement.
* **Dark mode:** support it properly (admins often work in dark mode for long sessions) - not just an inverted color filter, a genuinely designed dark palette.
* **Loading states:** every panel/table gets a skeleton matching its real layout, never a spinner-only blank screen, consistent with the platform's global UX requirements.
* **Responsive down to tablet width** at minimum; the admin panel doesn't need to be phone-first, but must not visibly break on a tablet.

\---

## 7\. VERIFICATION - PROVE IT'S ACTUALLY WORKING (mandatory)

For every phase in Section 5:

1. **Functional test:** every action listed for that phase's sections actually performs its described effect (e.g. "Ban account" genuinely prevents that user from logging in, not just changes a label).
2. **Permission test:** attempt each action as each of the 5 roles (Owner/Super Admin/Moderator/Support/Analyst) and confirm access is correctly allowed or denied per the Section 2 matrix - not just hidden in the UI, actually rejected server-side if attempted directly.
3. **Audit log test:** perform every mutating action in that phase and confirm a corresponding, accurate entry appears in Section 3.17's Audit Log.
4. **Scale test:** seed a large synthetic dataset (tens of thousands of rows minimum, ideally simulating the millions-of-rows scenario from the reference numbers) into the relevant tables for that phase and confirm the corresponding admin list/table still loads quickly, paginates correctly, and search/filter remains responsive - not just tested against a handful of demo rows.
5. **Design consistency check:** confirm the new section matches Section 6's direction and doesn't visually clash with previously completed sections.

\---

## 8\. FINAL QUALITY GATE

* \[ ] All 18 sections from Section 3 are present and fully functional, none skipped or left as static mockups.
* \[ ] The 5-role permission matrix is enforced server-side everywhere, not just hidden in the UI.
* \[ ] Every mutating action anywhere in the panel produces a real Audit Log entry.
* \[ ] Every table/list in the panel performs well under a large, realistic dataset (Section 7's scale test), using server-side pagination, indexed search, and virtualization.
* \[ ] Dashboard numbers and Analytics charts are sourced from real cached/aggregated data, never hardcoded.
* \[ ] The panel's visual design is consistent, light, and professional across every section, with working dark mode.
* \[ ] Database Management and System Monitoring are correctly restricted to Owner/developer-level access with confirmation steps on destructive actions.
* \[ ] A written, phase-by-phase completion report confirming the audit findings (✅/⚠️/❌) and that every checklist item above is genuinely met, not assumed.

