# TERA — Project Overview

## 1. Overview

### What is TERA?

**TERA** is a full-stack social media web application (similar to Instagram/Facebook) built as a Turborepo monorepo. It features posts, stories, reels, direct messaging, groups/communities, pages, notifications, admin moderation, creator monetization, and real-time WebSockets.

| Property | Value |
|---|---|
| **Type** | Full-stack Web Application |
| **Framework** | Next.js 15 (App Router, Server Components) |
| **Language** | TypeScript 5.4 |
| **UI** | React 19, Tailwind CSS 3.4, Lucide Icons |
| **Database** | SQLite (dev) / PostgreSQL (production) via Prisma 5.14 |
| **Auth** | NextAuth 5 (beta) — Google, GitHub, Credentials |
| **State Management** | Zustand 4.5, React Query (TanStack) 5.59 |
| **Real-time** | Socket.IO 4.8 (server + client) |
| **Monorepo** | Turborepo + pnpm workspaces |
| **Validation** | Zod 3.23 |
| **Styling** | Tailwind CSS + custom glassmorphism design system |
| **Other** | class-variance-authority, clsx, tailwind-merge, qrcode, otpauth, pino |

### How to Run

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Run database migrations
pnpm db:migrate

# Seed database (creates admin@tera.social / creator@tera.social with password: password123)
pnpm db:seed

# Start development server
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Type-check
pnpm typecheck

# Lint
pnpm lint
```

The app runs at `http://localhost:3000` by default.

---

## 2. Folder Structure

```
TERA/
├── apps/
│   └── web/                          # Main Next.js web application
│       ├── src/
│       │   ├── app/                  # Next.js App Router pages & API routes
│       │   │   ├── layout.tsx        # Root layout (dark mode, Providers wrapper)
│       │   │   ├── page.tsx          # Home page (feed)
│       │   │   ├── globals.css       # Global styles, design tokens, animations
│       │   │   ├── auth/             # Auth pages (login, register)
│       │   │   ├── api/              # API routes (NextAuth, upload, media)
│       │   │   ├── explore/          # Explore/discover page
│       │   │   ├── messages/         # Messaging inbox & chat
│       │   │   ├── notifications/    # Notifications page
│       │   │   ├── settings/         # User settings
│       │   │   ├── saved/            # Bookmarks/saved posts
│       │   │   ├── groups/           # Communities/groups listing & detail
│       │   │   ├── reels/            # Video reels feed
│       │   │   ├── post/[postId]/    # Single post detail page
│       │   │   ├── [username]/       # User profile page (dynamic)
│       │   │   ├── admin/            # Admin dashboard (admin only)
│       │   │   └── activity/         # User activity log
│       │   ├── components/           # All React client components
│       │   ├── server/               # Server-side logic
│       │   │   ├── actions/          # Next.js Server Actions (17 files)
│       │   │   ├── auth/             # NextAuth configuration
│       │   │   ├── repositories/     # Data access layer (3 repos)
│       │   │   ├── services/         # Business logic services (5 services)
│       │   │   └── socket/           # Socket.IO server setup
│       │   ├── lib/                  # Shared utilities
│       │   │   ├── providers.tsx     # SessionProvider + QueryClientProvider
│       │   │   ├── db.ts             # Prisma client singleton
│       │   │   ├── utils.ts          # cn(), formatDate, schemas, logger, storage
│       │   │   └── sounds.ts         # Web Audio API UI sound engine
│       │   ├── types/                # TypeScript type augmentations
│       │   └── __tests__/            # Unit tests (vitest)
│       ├── prisma/                   # Prisma migrations
│       ├── public/uploads/           # Uploaded media files
│       └── docs/                     # Documentation
│
├── packages/
│   ├── db/                           # Shared Prisma database package
│   │   ├── prisma/schema.prisma      # Full database schema (786 lines, 40+ models)
│   │   ├── src/index.ts              # PrismaClient singleton export
│   │   └── seed.ts                   # Database seeding script
│   │
│   ├── lib/                          # Shared utility library
│   │   └── src/
│   │       ├── index.ts              # Barrel export
│   │       ├── cache/lru.ts          # LRU cache implementation
│   │       ├── logger/index.ts       # Structured JSON logger
│   │       ├── storage/index.ts      # LocalStorageProvider (file uploads)
│   │       ├── validation/index.ts   # Zod schemas (register, login, profile, post, comment, message)
│   │       └── utils/index.ts        # cn(), formatDate, formatTimeAgo, slugify
│   │
│   └── ui/                           # Shared UI components (currently minimal)
│
├── package.json                      # Root monorepo config
├── pnpm-workspace.yaml               # pnpm workspace definition
├── turbo.json                        # Turborepo pipeline config
├── tsconfig.json                     # Root TypeScript config
├── .prettierrc                       # Prettier config
├── .env.example                      # Environment variable template
└── .gitignore
```

---

## 3. Pages / Routes

| Route | Page File | Purpose | Auth | Components Used | Server Actions / APIs |
|---|---|---|---|---|---|
| `/` | `src/app/page.tsx` | Home feed — shows posts, stories, suggestions | Required (redirect) | `HomeFeed`, `TopNav`, `Stories`, `PostComposer`, `RightSidebar`, `PostCard`, `CommentModal` | `getFeedPosts`, `getSuggestedUsers`, `getTrendingTopics`, `getActiveFriends`, `getStories` |
| `/auth/login` | `src/app/auth/login/page.tsx` | Login page with credentials sign-in | None | `LoginForm` (inline client component) | `signIn` (NextAuth client) |
| `/auth/register` | `src/app/auth/register/page.tsx` | User registration | None | `RegisterPage` (inline client component) | `registerUser` (server action) |
| `/[username]` | `src/app/[username]/page.tsx` | User profile page | None | `ProfilePageClient` | `getProfileByUsername` |
| `/post/[postId]` | `src/app/post/[postId]/page.tsx` | Single post detail view | Session read (no redirect) | `PostPageClient`, `PostCard`, `RightSidebar`, `CommentModal` | `getPostById`, `getFeedPosts`, `getSuggestedUsers`, `getTrendingTopics`, `getActiveFriends` |
| `/reels` | `src/app/reels/page.tsx` | Video reels feed | Required (redirect) | `WatchClient`, `PostCard`, `TopNav`, `RightSidebar` | `getVideoPosts`, `getSuggestedUsers`, `getTrendingTopics`, `getActiveFriends` |
| `/explore` | `src/app/explore/page.tsx` | Explore/discover users and hashtags | Required (redirect) | `AppShell`, `ExploreClient` | `getSuggestedUsers`, `getTrendingHashtags` |
| `/messages` | `src/app/messages/page.tsx` | Messaging inbox | Required (redirect) | `MessagesClient` | `getInbox` |
| `/messages/[id]` | `src/app/messages/[id]/page.tsx` | Specific conversation/chat | Required (redirect) | `MessagesClient` | `getInbox` |
| `/notifications` | `src/app/notifications/page.tsx` | Notifications list | Required (redirect) | `AppShell`, `NotificationsClient` | `getNotifications("all", 20)` |
| `/settings` | `src/app/settings/page.tsx` | User settings (account, privacy, appearance) | Required (redirect) | `SettingsClient` | `getSettings` |
| `/saved` | `src/app/saved/page.tsx` | Bookmarked/saved posts & collections | Required (redirect) | `SavedClient` | `getCollections`, `getSavedPosts` |
| `/groups` | `src/app/groups/page.tsx` | Groups/communities listing | Required (redirect) | `GroupsClient` | `getJoinedGroups`, `getExploreGroups` |
| `/groups/[id]` | `src/app/groups/[id]/page.tsx` | Single group detail | Required (redirect) | `GroupDetailsClient` | `getGroupDetails`, `getJoinRequests` |
| `/activity` | `src/app/activity/page.tsx` | User activity log/history | Required (redirect) | `ActivityLogClient` | `getActivityLog` |
| `/admin` | `src/app/admin/page.tsx` | Admin dashboard (stats, users, moderation) | **Admin only** | `AdminClient` | `getDashboardStats`, `getAdminUsers`, `getModerationQueue`, `getAnalyticsChartData` |

### API Routes

| Method | Path | File | Purpose | Auth |
|---|---|---|---|---|
| GET/POST | `/api/auth/[...nextauth]` | `src/app/api/auth/[...nextauth]/route.ts` | NextAuth catch-all (sign in, sign out, session) | NextAuth |
| POST | `/api/upload` | `src/app/api/upload/route.ts` | File upload (multipart/form-data) | **None** |
| GET | `/api/media/[...path]` | `src/app/api/media/[...path]/route.ts` | Serve uploaded media files (supports Range for video) | **None** |

---

## 4. Components

| Component | Location | Purpose | Props | Used In |
|---|---|---|---|---|
| **AppShell** | `src/components/AppShell.tsx` | Server component: full 3-column layout shell (TopNav + left sidebar + right sidebar) | `{ children }` | `/explore`, `/notifications` |
| **HomeFeed** | `src/components/HomeFeed.tsx` | Main home feed with stories, post composer, infinite-scroll feed, comment modal | `{ initialPosts, initialCursor, user, suggested, trending, active, initialStories }` | `/` |
| **PostCard** | `src/components/HomeFeed.tsx` (exported) | Individual post card with reactions, comments, repost, share, poll, media grid | `{ post, currentUserId, onCommentClick? }` | `HomeFeed`, `PostPageClient`, `WatchClient` |
| **CommentItem** | `src/components/HomeFeed.tsx` (exported) | Threaded comment with replies, reactions, edit/delete/pin | `{ comment, currentUserId, postAuthorId, depth?, onReplyClick? }` | `CommentPanel` (in HomeFeed) |
| **PostComposer** | `src/components/PostComposer.tsx` | Create new post with text, images, video, polls | `{ user }` | `HomeFeed` |
| **TopNav** | `src/components/TopNav.tsx` | Top navigation bar (search, notifications bell, user menu) | `{ user }` | `HomeFeed`, `AppShell`, `PostPageClient`, `WatchClient` |
| **RightSidebar** | `src/components/RightSidebar.tsx` | Right sidebar: suggested users, trending topics, active friends | `{ suggested, trending, active }` | `HomeFeed`, `AppShell`, `PostPageClient`, `WatchClient` |
| **Stories** | `src/components/Stories.tsx` | Stories ring with create/view functionality | `{ currentUser, stories }` | `HomeFeed` |
| **CommentModal** | `src/components/CommentModal.tsx` | Modal overlay for viewing/posting comments on a post | `{ postId, currentUserId, onClose }` | `HomeFeed`, `PostPageClient`, `WatchClient` |
| **ReactionsModal** | `src/components/ReactionsModal.tsx` | Modal showing list of users who reacted to a post | `{ postId, onClose }` | `PostCard` (via portal) |
| **VideoPlayer** | `src/components/VideoPlayer.tsx` | HTML5 video player with custom controls | `{ src, className? }` | `PostCard` |
| **ProfilePage** | `src/components/ProfilePage.tsx` | Full profile page with posts, followers, about, photos, pinned posts | `{ data }` (profile data object) | `/[username]` |
| **NotificationsClient** | `src/components/NotificationsClient.tsx` | Notifications list with mark-read, real-time updates | `{ initialNotifications, currentUserId }` | `/notifications` |
| **NotificationBell** | `src/components/NotificationBell.tsx` | Notification bell icon with unread count badge | (imported in TopNav) | `TopNav` |
| **MessagesClient** | `src/components/MessagesClient.tsx` | Full messaging UI: inbox list + chat view | `{ conversations, currentUserId, currentUser, initialConversationId? }` | `/messages`, `/messages/[id]` |
| **ChatClient** | `src/components/ChatClient.tsx` | Individual chat component (may be used within MessagesClient) | — | `MessagesClient` |
| **SettingsClient** | `src/components/SettingsClient.tsx` | Settings UI: account, privacy, messaging, security, appearance, notifications | `{ initialSettings }` | `/settings` |
| **SavedClient** | `src/components/SavedClient.tsx` | Bookmarks UI: collections and saved posts | `{ initialCollections, initialPosts, currentUserId }` | `/saved` |
| **ExploreClient** | `src/components/ExploreClient.tsx` | Explore page: search, trending hashtags, suggested users | `{ suggested, currentUserId, trendingHashtags }` | `/explore` |
| **GroupsClient** | `src/components/GroupsClient.tsx` | Groups listing: joined groups + discover groups | `{ joinedGroups, exploreGroups }` | `/groups` |
| **GroupDetailsClient** | `src/components/GroupDetailsClient.tsx` | Single group view: members, posts, join requests, announcements | `{ group, currentUserId, pendingJoinRequests }` | `/groups/[id]` |
| **AdminClient** | `src/components/AdminClient.tsx` | Admin dashboard: stats cards, user management, moderation queue, analytics chart | `{ stats, users, reports, chartData }` | `/admin` |
| **ActivityLogClient** | `src/components/ActivityLogClient.tsx` | Activity log list | `{ initialEvents }` | `/activity` |
| **SkeletonFeed** | `src/components/SkeletonFeed.tsx` | Loading skeleton placeholder for feed | — | Used as fallback during loading |

---

## 5. State / Important Variables

### Client-Side State (Zustand / React State)

The app primarily uses React `useState`/`useEffect` within client components. There is no global Zustand store currently active — all state is component-scoped.

Key client-side state variables:

| Variable | Location | Type | Purpose |
|---|---|---|---|
| `posts` | `HomeFeed` | `any[]` | Current feed posts (paginated) |
| `cursor` | `HomeFeed` | `string \| null` | Cursor for infinite scroll pagination |
| `feedType` | `HomeFeed` | `"foryou" \| "recent"` | Feed algorithm toggle |
| `openCommentsPostId` | `HomeFeed` | `string \| null` | Which post's comment modal is open |
| `optimisticReactions` | `PostCard` | `any[]` | Optimistic reaction state for immediate UI feedback |
| `isSaved` | `PostCard` | `boolean` | Bookmark state (optimistic) |
| `isReposted` | `PostCard` | `boolean` | Repost state (optimistic) |
| `showComments` | `PostCard` | `boolean` | Inline comment panel toggle |
| `showMenu` | `PostCard` | `boolean` | Overflow menu (edit/delete/report) |
| `feedType` | `HomeFeed` | `"foryou" \| "recent"` | Toggle between algorithmic and chronological feed |

### Session / Auth Variables (NextAuth JWT)

Enriched via JWT callback in `src/server/auth/config.ts`:

| Variable | Type | Source | Where Read |
|---|---|---|---|
| `user.id` | `string` | `User.id` from DB | All server actions via `auth()` |
| `user.username` | `string` | `Profile.username` from DB | Navigation, profile links |
| `user.isAdmin` | `boolean` | `User.isAdmin` from DB | Admin page guard, admin link visibility |
| `user.isVerified` | `boolean` | `User.isVerified` from DB | Profile display |
| `user.verifiedBadge` | `boolean` | `User.verifiedBadge` from DB | Verified badge display |
| `user.twoFactorEnabled` | `boolean` | `User.twoFactorEnabled` from DB | Settings, login flow |

### Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | Database connection string | `file:./dev.db` (SQLite) |
| `NEXTAUTH_URL` | App URL for NextAuth | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | NextAuth JWT signing secret | `secret-change-me-in-production-12345678` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | (empty) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | (empty) |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | (empty) |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | (empty) |
| `NEXT_PUBLIC_WS_URL` | WebSocket server URL | `http://localhost:3000` |
| `NODE_ENV` | Environment mode | `development` |

---

## 6. Database / Models

### Database: SQLite (dev) / PostgreSQL (prod) via Prisma

Full schema at `packages/db/prisma/schema.prisma` (786 lines, 40+ models).

### Core Models

| Model | Key Fields | Purpose |
|---|---|---|
| **User** | `id`, `email`, `phone`, `passwordHash`, `isAdmin`, `isSuspended`, `isBanned`, `isVerified`, `verifiedBadge`, `twoFactorEnabled`, `twoFactorSecret`, `lastActiveAt`, `onlineStatusPrivacy`, `lastSeenPrivacy`, `readReceiptsEnabled`, `typingIndicatorEnabled` | User accounts with auth, security, and privacy settings |
| **Profile** | `id`, `userId` (unique), `displayName`, `username` (unique), `avatarUrl`, `coverUrl`, `bio`, `websiteUrl`, `location`, `relationshipStatus`, `privacyLevel`, `education` (JSON), `work` (JSON), `skills` (JSON), `languages` (JSON), `interests` (JSON) | User profile data |
| **Post** | `id`, `userId`, `type` (TEXT/IMAGE/CAROUSEL/VIDEO/POLL/REEL), `content`, `mediaUrls` (JSON), `visibility`, `groupId`, `pageId`, `location`, `feeling`, `viewCount`, `shareCount`, `isPinned`, `isEdited`, `parentPostId` | Posts with multiple types and privacy |
| **Comment** | `id`, `postId`, `reelId`, `userId`, `content`, `parentId`, `isEdited`, `isDeleted`, `isPinned` | Threaded comments (self-referencing parent/replies) |
| **Reaction** | `id`, `userId`, `postId`, `commentId`, `reelId`, `type` (LIKE/LOVE/HAHA/WOW/SAD/ANGRY) | Reactions on posts, comments, and reels |
| **Story** | `id`, `userId`, `mediaUrl`, `type`, `textContent`, `textStyle` (JSON), `stickers` (JSON), `audience`, `expiresAt`, `archivedAt` | Stories with image/video/text support |
| **Reel** | `id`, `userId`, `videoUrl`, `caption` | Short video content |

### Social Models

| Model | Key Fields | Purpose |
|---|---|---|
| **Follow** | `followerId`, `followeeId` | User following relationships |
| **Block** | `blockerId`, `blockedId` | User blocking |
| **Mute** | `muterId`, `mutedId` | User muting |
| **UserRestrict** | `restrictorId`, `restrictedId` | User restriction |

### Messaging Models

| Model | Key Fields | Purpose |
|---|---|---|
| **Conversation** | `id`, `isGroup`, `name`, `avatarUrl`, `description` | Chat conversations (DM and group) |
| **ConversationParticipant** | `conversationId`, `userId`, `role`, `isPinned`, `isArchived`, `isMuted`, `lastReadAt` | Conversation membership and settings |
| **Message** | `conversationId`, `senderId`, `content`, `mediaUrl`, `mediaType`, `replyToId`, `isEdited`, `deletedForAll`, `reactions` (JSON), `readBy` (JSON) | Messages with rich features |

### Groups & Pages Models

| Model | Key Fields | Purpose |
|---|---|---|
| **Group** | `id`, `name`, `description`, `coverUrl`, `ownerId`, `isPrivate` | Groups/communities |
| **GroupMember** | `groupId`, `userId`, `role` (ADMIN/MODERATOR/MEMBER), `isMuted`, `isBanned` | Group membership |
| **GroupJoinRequest** | `groupId`, `userId`, `status` (PENDING/APPROVED/DENIED) | Private group join requests |
| **GroupRule** | `groupId`, `title`, `description`, `sortOrder` | Group rules |
| **GroupAnnouncement** | `groupId`, `content`, `authorId`, `isPinned` | Group announcements |
| **Page** | `id`, `name`, `category`, `description`, `ownerId` | Pages (like Facebook pages) |
| **PageFollower** | `pageId`, `userId` | Page followers |

### Other Models

| Model | Purpose |
|---|---|
| **Notification** | Notifications (FOLLOW, REACTION, COMMENT, MESSAGE, etc.) |
| **Bookmark / BookmarkCollection** | Saved posts organized into collections |
| **Hashtag / PostHashtag** | Hashtag system for posts |
| **Poll / PollOption / PollVote** | Polls on posts |
| **StoryView / StoryReaction** | Story engagement tracking |
| **StoryHighlight / HighlightStory** | Story highlights (like Instagram) |
| **Report / ModerationQueue** | Content reporting and moderation |
| **Tip / Subscription** | Creator monetization |
| **LoginHistory / UserSession / RecoveryCode** | Security tracking |
| **NotificationPreference / AppearanceSetting** | User preferences |
| **FeedHide / PostView** | Feed personalization |
| **AnalyticsEvent** | Analytics tracking |
| **TrendingHashtag** | Computed trending hashtags |
| **JobQueue** | Background job queue |
| **FeatureFlag** | Dynamic admin feature flags |

### Key Relationships

```
User ──1:1── Profile
User ──1:N── Post, Comment, Reaction, Story, Reel
User ──M:N── Follow (Follower ↔ Followee)
User ──M:N── Block, Mute, UserRestrict
User ──1:N── ConversationParticipant ──N:1── Conversation
Conversation ──1:N── Message
User ──1:N── Group (as owner)
User ──M:N── GroupMember ──N:1── Group
Group ──1:N── GroupJoinRequest, GroupRule, GroupAnnouncement
User ──1:N── Page (as owner)
Page ──M:N── PageFollower ──N:1── User
Post ──1:N── Comment (self-referencing for replies)
Post ──1:1── Poll ──1:N── PollOption ──1:N── PollVote
Post ──M:N── Reaction (polymorphic: Post | Comment | Reel)
Post ──M:N── Bookmark ──N:1── BookmarkCollection
Story ──1:N── StoryView, StoryReaction
StoryHighlight ──M:N── HighlightStory ──N:1── Story
Notification ──N:1── User (sender + receiver)
```

---

## 7. APIs / Endpoints (Server Actions)

### Post Actions (`src/server/actions/posts.ts`)

| Function | Method | Input | Output | Frontend Usage |
|---|---|---|---|---|
| `createPost` | Mutation | `formData: { content?, mediaUrls?, type, visibility, groupId?, pageId?, pollQuestion?, pollOptions?, location?, feeling? }` | `{ success, post?, error? }` | `PostComposer` |
| `toggleReaction` | Mutation | `{ postId?, commentId?, reelId?, type }` | `{ success, action?, error? }` | `PostCard`, `CommentItem` |
| `addComment` | Mutation | `{ postId?, reelId?, content, parentId? }` | `{ success, comment?, error? }` | `CommentPanel`, `CommentItem` |
| `votePoll` | Mutation | `optionId: string` | `{ success, vote?, error? }` | `PostCard` (poll section) |
| `savePost` | Mutation | `postId: string, collectionId?` | `{ success, error? }` | `PostCard` |
| `unsavePost` | Mutation | `postId: string` | `{ success, error? }` | `PostCard` |
| `viewPost` | Mutation | `postId: string` | `{ success }` | `PostCard` (intersection observer) |
| `sharePost` | Mutation | `postId: string` | `{ success, shareCount?, error? }` | `ShareMenu` |
| `hidePost` | Mutation | `postId: string, reason?` | `{ success, error? }` | `OverflowMenu` |
| `reportPost` | Mutation | `postId: string, reason: string, details?` | `{ success, report?, error? }` | `OverflowMenu` |
| `editPost` | Mutation | `postId: string, content: string` | `{ success, error? }` | `OverflowMenu` |
| `deletePost` | Mutation | `postId: string` | `{ success, error? }` | `OverflowMenu` |
| `editComment` | Mutation | `commentId: string, content: string` | `{ success, comment?, error? }` | `CommentItem` |
| `deleteComment` | Mutation | `commentId: string` | `{ success, error? }` | `CommentItem` |
| `pinComment` | Mutation | `commentId: string, isPinned: boolean` | `{ success, comment?, error? }` | `CommentItem` |
| `getPostById` | Query | `postId: string` | `{ success, post?, notFound?, isPrivate? }` | `/post/[postId]` page |
| `getComments` | Query | `postId: string, sortBy: "relevant" \| "newest"` | `{ success, comments? }` | `CommentPanel` |
| `getPostReactors` | Query | `postId: string, type?, cursor?, limit?` | `{ success, reactors?, nextCursor?, hasMore? }` | `ReactionsModal` |
| `repostPost` | Mutation | `postId: string, content?` | `{ success, post?, error? }` | `PostCard` |
| `unrepostPost` | Mutation | `postId: string` | `{ success, error? }` | `PostCard` |

### Feed Actions (`src/server/actions/feed.ts`)

| Function | Input | Output | Frontend Usage |
|---|---|---|---|
| `getFeedPosts` | `cursor?, feedType: "foryou" \| "recent", limit?` | `{ posts, nextCursor }` | `HomeFeed`, `PostPageClient` |
| `getVideoPosts` | `cursor?, limit?` | `{ posts, nextCursor }` | `WatchClient` |
| `getSuggestedUsers` | `limit?` | `any[]` | `HomeFeed`, `RightSidebar`, `ExploreClient` |
| `getTrendingTopics` | `limit?` | `{ tag, count }[]` | `RightSidebar` |
| `getActiveFriends` | `limit?` | `any[]` | `RightSidebar` |

### Auth Actions (`src/server/actions/auth.ts`)

| Function | Input | Output | Frontend Usage |
|---|---|---|---|
| `registerUser` | `{ email, password, displayName, username }` | `{ success, error? }` | `/auth/register` |
| `verifyEmail` | `userId: string` | `{ success, error? }` | — |
| `generate2FASecret` | `userId: string` | `{ success, secret?, qrCodeDataUrl?, error? }` | Settings |
| `verifyAndEnable2FA` | `userId: string, code: string` | `{ success, error? }` | Settings |
| `disable2FA` | `userId: string` | `{ success, error? }` | Settings |

### Social Actions (`src/server/actions/social.ts`)

| Function | Input | Output | Frontend Usage |
|---|---|---|---|
| `followUser` | `targetUserId: string` | `{ success, following?, error? }` | `ProfilePage`, `ExploreClient` |
| `unfollowUser` | `targetUserId: string` | `{ success, following?, error? }` | `ProfilePage`, `ExploreClient` |
| `getProfileByUsername` | `username: string` | `{ profile, isFollowing, isOwnProfile, ... } \| null` | `/[username]` page |
| `updateProfile` | `{ displayName?, bio?, avatarUrl?, coverUrl?, websiteUrl?, location? }` | `{ success, error? }` | `SettingsClient` |
| `searchUsers` | `query: string` | `any[]` | `TopNav` search |
| `muteUser` | `targetUserId: string` | `{ success, action?, error? }` | Profile actions |
| `unmuteUser` | `targetUserId: string` | `{ success, action?, error? }` | Profile actions |
| `restrictUser` | `targetUserId: string` | `{ success, action?, error? }` | Profile actions |
| `unrestrictUser` | `targetUserId: string` | `{ success, action?, error? }` | Profile actions |
| `reportProfile` | `targetUserId: string, reason: string` | `{ success, error? }` | Profile actions |

### Messaging Actions (`src/server/actions/messaging.ts`)

| Function | Input | Output | Frontend Usage |
|---|---|---|---|
| `getInbox` | — | `any[]` | `/messages`, `/messages/[id]` |
| `getConversationMessages` | `conversationId: string` | `any[]` | `MessagesClient` |
| `createDM` | `targetUserId: string` | `{ success, conversation? }` | Profile action |
| `createGroupConversation` | `name, memberIds[], avatarUrl?` | `{ success, conversation?, error? }` | MessagesClient |
| `saveMessage` | `{ conversationId, content?, mediaUrl?, mediaType?, replyToId? }` | `{ success, message?, error? }` | `MessagesClient` (via socket) |
| `editMessage` | `messageId, newContent` | `{ success, message?, error? }` | `MessagesClient` |
| `deleteMessage` | `messageId` | `{ success, message?, error? }` | `MessagesClient` |
| `reactToMessage` | `messageId, emoji` | `{ success, message?, error? }` | `MessagesClient` |
| `markAsRead` | `messageIds[]` | `{ success, error? }` | `MessagesClient` |
| `updateConversationSettings` | `conversationId, { isMuted?, isArchived?, isPinned? }` | `{ success, error? }` | `MessagesClient` |
| `addGroupMembers` | `conversationId, userIds[]` | `{ success, error? }` | `MessagesClient` |
| `removeGroupMember` | `conversationId, memberId` | `{ success, error? }` | `MessagesClient` |

### Notification Actions (`src/server/actions/notifications.ts`)

| Function | Input | Output | Frontend Usage |
|---|---|---|---|
| `getNotifications` | `filter?: "all" \| "unread", limit?, cursor?` | `{ notifications, nextCursor }` | `/notifications` |
| `getUnreadCount` | — | `number` | `NotificationBell` |
| `markNotificationAsRead` | `id: string` | `{ success }` | `NotificationsClient` |
| `markAllRead` | — | `{ success }` | `NotificationsClient` |
| `deleteNotification` | `id: string` | `{ success }` | `NotificationsClient` |

### Settings Actions (`src/server/actions/settings.ts`)

| Function | Input | Output | Frontend Usage |
|---|---|---|---|
| `getSettings` | — | `any` | `/settings` |
| `updateAccountSettings` | `{ displayName?, email?, password? }` | `{ success, error? }` | `SettingsClient` |
| `updatePrivacySettings` | `{ privacyLevel }` | `{ success, error? }` | `SettingsClient` |
| `updateMessagingPrivacySettings` | `{ showOnlineStatus?, showLastSeen?, showReadReceipts?, showTypingIndicator? }` | `{ success, error? }` | `SettingsClient` |
| `updateSecuritySettings` | `{ twoFactorEnabled }` | `{ success, error? }` | `SettingsClient` |
| `updateAppearanceSettings` | `{ theme?, fontSize?, reducedMotion? }` | `{ success, error? }` | `SettingsClient` |
| `updateNotificationPreference` | `category, settings` | `{ success, error? }` | `SettingsClient` |

### Admin Actions (`src/server/actions/admin.ts`)

| Function | Input | Output | Frontend Usage |
|---|---|---|---|
| `getDashboardStats` | — | `{ totalUsers, totalPosts, totalComments, totalReactions, totalPlatformRevenue, pendingReports }` | `/admin` |
| `getAdminUsers` | — | `any[]` | `/admin` |
| `getModerationQueue` | — | `any[]` | `/admin` |
| `getAnalyticsChartData` | — | `any[]` | `/admin` |
| `toggleAdminStatus` | `userId: string` | `{ success, user?, error? }` | `AdminClient` |
| `toggleVerificationBadge` | `userId: string` | `{ success, user?, error? }` | `AdminClient` |
| `resolveReport` | `id, decision` | `{ success, error? }` | `AdminClient` |
| `blockOrWarnUser` | `userId, action` | `{ success, error? }` | `AdminClient` |

### Other Action Modules

| Module | Key Functions |
|---|---|
| **stories.ts** | `getStories`, `createStory`, `createTextStory`, `markStoryViewed`, `getStoryViewers`, `archiveStory`, `createHighlight`, `addToHighlight`, `getMyHighlights` |
| **communities.ts** | `createGroup`, `joinGroup`, `leaveGroup`, `getGroupDetails`, `getJoinRequests`, `handleJoinRequest`, `createAnnouncement`, `createGroupRule`, `getJoinedGroups`, `getExploreGroups` |
| **saved.ts** | `getCollections`, `createCollection`, `deleteCollection`, `savePost`, `unsavePost`, `getSavedPosts` |
| **profile.ts** | `updateProfile`, `updateAbout`, `pinPost`, `unpinPost`, `getPinnedPosts`, `getProfilePhotos`, `getProfileVideos` |
| **search.ts** | `searchAll`, `getSearchSuggestions`, `getTrendingHashtags`, `getTrendingPosts`, `getHashtagPosts` |
| **activity.ts** | `getActivityLog`, `logUserActivity`, `clearActivityLog` |
| **moderation.ts** | `reportPost`, `getPendingModerationQueue`, `moderateContent`, `exportUserData` (GDPR) |
| **content.ts** | `createStory`, `viewStory`, `reactToStory`, `getActiveStories`, `createReel`, `getReels` |
| **creator.ts** | `sendTip`, `subscribeToCreator`, `getCreatorDashboardStats` |

---

## 8. Relationships & Dependencies Between Files

### Page → Component → Server Action Map

```
app/page.tsx (HomePage)
  └─→ HomeFeed
        ├─→ TopNav
        ├─→ Stories
        │     └─→ stories.getStories()
        ├─→ PostComposer
        │     └─→ posts.createPost()
        ├─→ PostCard (×N)
        │     ├─→ posts.toggleReaction()
        │     ├─→ posts.viewPost()
        │     ├─→ posts.savePost() / unsavePost()
        │     ├─→ posts.repostPost() / unrepostPost()
        │     ├─→ posts.hidePost()
        │     ├─→ posts.reportPost()
        │     ├─→ posts.editPost() / deletePost()
        │     ├─→ posts.getComments()
        │     ├─→ CommentPanel → posts.addComment()
        │     ├─→ VideoPlayer
        │     └─→ ReactionsModal → posts.getPostReactors()
        ├─→ CommentModal → posts.getComments(), posts.addComment()
        ├─→ RightSidebar
        │     ├─→ feed.getSuggestedUsers()
        │     ├─→ feed.getTrendingTopics()
        │     └─→ feed.getActiveFriends()
        └─→ feed.getFeedPosts() (infinite scroll)

app/[username]/page.tsx (UserProfilePage)
  └─→ ProfilePage
        ├─→ social.getProfileByUsername()
        ├─→ social.followUser() / unfollowUser()
        ├─→ social.muteUser() / restrictUser()
        ├─→ profile.pinPost() / unpinPost()
        └─→ posts (from profile data)

app/post/[postId]/page.tsx (PostPage)
  └─→ PostPageClient
        ├─→ PostCard (pinned post)
        ├─→ PostCard (×N, infinite scroll)
        ├─→ RightSidebar
        ├─→ CommentModal
        └─→ posts.getPostById()

app/reels/page.tsx (ReelsPage)
  └─→ WatchClient
        ├─→ PostCard (×N, video type)
        ├─→ RightSidebar
        └─→ feed.getVideoPosts()

app/explore/page.tsx (ExplorePage)
  ├─→ AppShell (layout)
  └─→ ExploreClient
        ├─→ social.getSuggestedUsers()
        └─→ search.getTrendingHashtags()

app/messages/page.tsx (MessagesPage)
  └─→ MessagesClient
        ├─→ messaging.getInbox()
        ├─→ messaging.getConversationMessages()
        ├─→ messaging.saveMessage()
        └─→ messaging.createDM() / createGroupConversation()

app/notifications/page.tsx (NotificationsPage)
  ├─→ AppShell (layout)
  └─→ NotificationsClient
        ├─→ notifications.getNotifications()
        └─→ notifications.markNotificationAsRead() / markAllRead()

app/settings/page.tsx (SettingsPage)
  └─→ SettingsClient
        ├─→ settings.getSettings()
        ├─→ settings.updateAccountSettings()
        ├─→ settings.updatePrivacySettings()
        ├─→ settings.updateSecuritySettings()
        └─→ settings.updateAppearanceSettings()

app/saved/page.tsx (SavedPage)
  └─→ SavedClient
        ├─→ saved.getCollections()
        ├─→ saved.getSavedPosts()
        └─→ saved.createCollection() / deleteCollection()

app/groups/page.tsx (GroupsPage)
  └─→ GroupsClient
        ├─→ communities.getJoinedGroups()
        └─→ communities.getExploreGroups()

app/groups/[id]/page.tsx (GroupPage)
  └─→ GroupDetailsClient
        ├─→ communities.getGroupDetails()
        ├─→ communities.getJoinRequests()
        └─→ communities.handleJoinRequest() / joinGroup() / leaveGroup()

app/admin/page.tsx (AdminPage)
  └─→ AdminClient
        ├─→ admin.getDashboardStats()
        ├─→ admin.getAdminUsers()
        ├─→ admin.getModerationQueue()
        ├─→ admin.getAnalyticsChartData()
        ├─→ admin.toggleAdminStatus() / toggleVerificationBadge()
        ├─→ admin.resolveReport()
        └─→ admin.blockOrWarnUser()

app/activity/page.tsx (ActivityLogPage)
  └─→ ActivityLogClient
        └─→ activity.getActivityLog()
```

### Server-Side Architecture

```
Server Actions (src/server/actions/)
  ├─→ Repositories (src/server/repositories/)
  │     ├─→ UserRepository    (users, profiles, follows, blocks)
  │     ├─→ PostRepository    (posts, reactions, comments, bookmarks, polls)
  │     └─→ MessageRepository (conversations, messages)
  └─→ Services (src/server/services/)
        ├─→ FeedService          (algorithmic/chronological feed ranking)
        ├─→ TrendingService      (hashtag trending computation)
        ├─→ RecommendationService (user suggestions)
        ├─→ ModerationService    (content moderation)
        └─→ AnalyticsService     (analytics tracking)

All DB access goes through: src/lib/db.ts → PrismaClient singleton
```

### Real-Time Layer

```
Socket.IO Server (src/server/socket/index.ts)
  ├─→ Presence events (online/offline status)
  ├─→ Conversation events (join/leave rooms)
  ├─→ Typing indicators
  ├─→ Message events (send/edit/delete/react)
  ├─→ Read/delivery receipts
  ├─→ Notification events (cross-tab sync)
  ├─→ Post events (real-time reactions/comments)
  └─→ WebRTC signaling (audio/video calls)
```

---

## 9. Important Notes

### Conventions & Patterns

1. **Server-First Architecture:** All pages (except auth) use async Server Components that fetch data server-side, then pass props to `"use client"` child components. This minimizes client-side waterfalls.

2. **Consistent Auth Guard:** Nearly every page follows this pattern:
   ```tsx
   const session = await auth();
   if (!session?.user) redirect("/auth/login");
   ```

3. **Optimistic Updates:** Client-side state is updated immediately before server confirmation (reactions, saves, reposts) for instant UI feedback, with rollback on failure.

4. **Dynamic Imports:** Server actions are dynamically imported in client components (`await import("@/server/actions/posts")`) to reduce initial bundle size.

5. **Design System:** Dark theme with glassmorphism (`.glass`, `.glass-light`), violet/pink gradients, custom animations (`shimmer`, `fadeSlideUp`, `heartbeat`, `story-progress`), and Inter font.

6. **UI Sound Engine:** Web Audio API-synthesized sounds for reactions, comments, messages, notifications — no external audio files.

### Issues & Technical Debt

1. **Duplicated Layout Code:** `HomeFeed`, `PostPageClient`, and `WatchClient` each render their own left sidebar + right sidebar layout with identical navigation. Only `/explore` and `/notifications` use the shared `AppShell` component. This should be consolidated.

2. **Missing Auth on Upload API:** The `/api/upload` endpoint has no authentication check — any unauthenticated user can upload files.

3. **Missing Auth on Auth Actions:** `registerUser`, `verifyEmail`, `generate2FASecret`, `verifyAndEnable2FA`, `disable2FA` in `src/server/actions/auth.ts` accept raw `userId` parameters without verifying the caller's identity — a security risk.

4. **Duplicate Code:** `LocalStorageProvider` and utility functions (`cn`, `formatDate`, `formatTimeAgo`, `slugify`, validation schemas, logger) are duplicated between `apps/web/src/lib/utils.ts` and `packages/lib/src/`. The web app's `utils.ts` contains its own copies instead of importing from the shared package.

5. **SQLite in Development:** Uses SQLite which lacks features like full-text search, array types, and JSON operations. The schema uses JSON strings (e.g., `"[]"` for arrays) instead of native array types.

6. **No API Route Protection:** The `/api/upload` and `/api/media/[...path]` routes have no auth middleware.

7. **Prisma Schema Duplication:** There are two separate Prisma schemas — one in `packages/db/prisma/schema.prisma` and a separate one at `apps/web/prisma/` (with migrations). These should be unified.

8. **Left Nav Inconsistency:** The `LEFT_NAV` array in `HomeFeed` points to `/bookmarks` while the actual route is `/saved`. The `AppShell` uses the correct `/saved` path.

9. **Story Highlights Raw SQL:** The `stories.ts` actions use raw SQL for `StoryHighlight` and `HighlightStory` queries instead of Prisma relations, suggesting the Prisma schema may be missing proper relations for highlights.

10. **No Error Boundaries:** No `error.tsx` or `not-found.tsx` files exist in the app directory for graceful error handling.

11. **Test Coverage:** Only 2 test files exist (`posts.test.ts`, `auth.test.ts`) — minimal coverage for a project of this size.

12. **WebRTC Signaling:** The Socket.IO server includes WebRTC signaling for audio/video calls, but there is no visible frontend UI for calls.
