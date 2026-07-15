import { PrismaClient } from "@prisma/client";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning database...");
  await prisma.tip.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.pollVote.deleteMany();
  await prisma.pollOption.deleteMany();
  await prisma.poll.deleteMany();
  await prisma.postHashtag.deleteMany();
  await prisma.hashtag.deleteMany();
  await prisma.bookmark.deleteMany();
  await prisma.bookmarkCollection.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.pageFollower.deleteMany();
  await prisma.page.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.reaction.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.storyReaction.deleteMany();
  await prisma.storyView.deleteMany();
  await prisma.story.deleteMany();
  await prisma.reel.deleteMany();
  await prisma.post.deleteMany();
  await prisma.mute.deleteMany();
  await prisma.block.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.featureFlag.deleteMany();
  await prisma.user.deleteMany();

  console.log("Seeding base feature flags...");
  await prisma.featureFlag.createMany({
    data: [
      { key: "creator-monetization", isEnabled: true, description: "Tips and Creator Subscriptions" },
      { key: "ai-moderation", isEnabled: false, description: "Automatic post content moderation using LLM" },
      { key: "video-calling", isEnabled: false, description: "Realtime peer-to-peer WebRTC video calling" },
    ],
  });

  console.log("Seeding 20 users...");
  const users = [];
  
  // Admin User
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@tera.social",
      phone: "1234567890",
      passwordHash: "$2a$12$R.S2uU2BvL5K1.N6iT9y9eH7bZ9C3uC5/6Nq2d9g/i8q6lU/t1Z5C", // password123
      isAdmin: true,
      isVerified: true,
      verifiedBadge: true,
      profile: {
        create: {
          displayName: "TERA Admin",
          username: "admin",
          bio: "Official administrator account.",
          avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
          coverUrl: "https://images.unsplash.com/photo-1707343843437-caacff5cfa74?w=800",
          privacyLevel: "PUBLIC",
        },
      },
    },
  });
  users.push(adminUser);

  // Creator User
  const creatorUser = await prisma.user.create({
    data: {
      email: "creator@tera.social",
      passwordHash: "$2a$12$R.S2uU2BvL5K1.N6iT9y9eH7bZ9C3uC5/6Nq2d9g/i8q6lU/t1Z5C", // password123
      isVerified: true,
      verifiedBadge: true,
      profile: {
        create: {
          displayName: "Jane The Creator",
          username: "jane",
          bio: "Digital creator & travel blogger. Subscribe for exclusive insights!",
          avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
          coverUrl: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800",
          privacyLevel: "PUBLIC",
        },
      },
    },
  });
  users.push(creatorUser);

  // Standard Users
  for (let i = 0; i < 18; i++) {
    const gender = i % 2 === 0 ? "female" : "male";
    const firstName = faker.person.firstName(gender);
    const lastName = faker.person.lastName();
    const username = faker.internet.userName({ firstName, lastName }).toLowerCase().replace(/[^a-z0-9]/g, "");
    
    const user = await prisma.user.create({
      data: {
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        passwordHash: "$2a$12$R.S2uU2BvL5K1.N6iT9y9eH7bZ9C3uC5/6Nq2d9g/i8q6lU/t1Z5C", // password123
        isVerified: faker.datatype.boolean(0.8),
        verifiedBadge: faker.datatype.boolean(0.15),
        profile: {
          create: {
            displayName: `${firstName} ${lastName}`,
            username: username,
            bio: faker.lorem.sentence(),
            avatarUrl: faker.image.avatar(),
            coverUrl: faker.image.url(),
            privacyLevel: faker.helpers.arrayElement(["PUBLIC", "FRIENDS", "PRIVATE"]),
          },
        },
      },
    });
    users.push(user);
  }

  console.log("Seeding Follows...");
  for (const user of users) {
    // Follow 3-7 random users
    const count = faker.number.int({ min: 3, max: 7 });
    const targets = faker.helpers.arrayElements(
      users.filter((u) => u.id !== user.id),
      count
    );
    for (const target of targets) {
      await prisma.follow.create({
        data: {
          followerId: user.id,
          followeeId: target.id,
        },
      }).catch(() => {}); // ignore unique constraint fails
    }
  }

  console.log("Seeding Hashtags...");
  const hashtags = ["tech", "photography", "travel", "nature", "summer", "vibes", "coding", "food", "lifestyle"];
  const hashtagModels = [];
  for (const tag of hashtags) {
    const h = await prisma.hashtag.create({
      data: { name: tag },
    });
    hashtagModels.push(h);
  }

  console.log("Seeding Groups & Pages...");
  const baseGroup = await prisma.group.create({
    data: {
      name: "JavaScript Developers",
      description: "A community for JS, TS, Node and Next.js developers.",
      ownerId: users[1]!.id,
      isPrivate: false,
    },
  });

  const basePage = await prisma.page.create({
    data: {
      name: "Tera Tech Insights",
      category: "Education",
      description: "Everything about technology and engineering trends.",
      ownerId: users[1]!.id,
    },
  });

  // Add members to JavaScript Developers Group
  for (const user of users) {
    if (faker.datatype.boolean(0.6)) {
      await prisma.groupMember.create({
        data: {
          groupId: baseGroup.id,
          userId: user.id,
          role: user.id === users[1]!.id ? "ADMIN" : "MEMBER",
        },
      });
    }
  }

  console.log("Seeding Posts...");
  const postTypes = ["TEXT", "IMAGE", "CAROUSEL", "VIDEO", "POLL"];
  const posts = [];
  for (let i = 0; i < 40; i++) {
    const user = faker.helpers.arrayElement(users);
    const type = faker.helpers.arrayElement(postTypes);
    
    let mediaUrls = "[]";
    if (type === "IMAGE") {
      mediaUrls = JSON.stringify([faker.image.urlLoremFlickr({ category: "nature" })]);
    } else if (type === "CAROUSEL") {
      mediaUrls = JSON.stringify([
        faker.image.urlLoremFlickr({ category: "city" }),
        faker.image.urlLoremFlickr({ category: "business" }),
      ]);
    } else if (type === "VIDEO") {
      mediaUrls = JSON.stringify(["https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"]);
    }

    const inGroup = faker.datatype.boolean(0.2);
    const inPage = !inGroup && faker.datatype.boolean(0.2);

    const post = await prisma.post.create({
      data: {
        userId: user.id,
        type: type === "POLL" ? "TEXT" : type,
        content: faker.lorem.paragraph(),
        mediaUrls: mediaUrls,
        visibility: "PUBLIC",
        groupId: inGroup ? baseGroup.id : null,
        pageId: inPage ? basePage.id : null,
      },
    });

    if (type === "POLL") {
      await prisma.poll.create({
        data: {
          postId: post.id,
          question: "Which React framework do you prefer?",
          options: {
            create: [
              { text: "Next.js" },
              { text: "Remix" },
              { text: "Vite SPA" },
            ],
          },
        },
      });
    }

    // Add 1-2 hashtags
    const selectedTags = faker.helpers.arrayElements(hashtagModels, faker.number.int({ min: 1, max: 2 }));
    for (const tag of selectedTags) {
      await prisma.postHashtag.create({
        data: {
          postId: post.id,
          hashtagId: tag.id,
        },
      }).catch(() => {});
    }

    posts.push(post);
  }

  console.log("Seeding Stories and Reels...");
  for (let i = 0; i < 15; i++) {
    const user = faker.helpers.arrayElement(users);
    await prisma.story.create({
      data: {
        userId: user.id,
        mediaUrl: faker.image.urlLoremFlickr({ category: "people" }),
        type: "IMAGE",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      },
    });

    await prisma.reel.create({
      data: {
        userId: user.id,
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
        caption: faker.lorem.sentence(),
      },
    });
  }

  console.log("Seeding Comments & Reactions...");
  for (const post of posts) {
    // Add 1 to 5 reactions
    const reactUsers = faker.helpers.arrayElements(users, faker.number.int({ min: 1, max: 5 }));
    for (const ru of reactUsers) {
      await prisma.reaction.create({
        data: {
          userId: ru.id,
          postId: post.id,
          type: faker.helpers.arrayElement(["LIKE", "LOVE", "HAHA", "WOW", "SAD", "ANGRY"]),
        },
      });
    }

    // Add 1 to 3 comments
    const commentCount = faker.number.int({ min: 1, max: 3 });
    for (let c = 0; c < commentCount; c++) {
      const cu = faker.helpers.arrayElement(users);
      const parent = await prisma.comment.create({
        data: {
          postId: post.id,
          userId: cu.id,
          content: faker.lorem.sentence(),
        },
      });

      // Add a reply to 40% of comments
      if (faker.datatype.boolean(0.4)) {
        const ru = faker.helpers.arrayElement(users);
        await prisma.comment.create({
          data: {
            postId: post.id,
            userId: ru.id,
            content: faker.lorem.sentence(),
            parentId: parent.id,
          },
        });
      }
    }
  }

  console.log("Seeding Messaging...");
  // Create 5 random conversations
  for (let i = 0; i < 5; i++) {
    const pair = faker.helpers.arrayElements(users, 2);
    const conv = await prisma.conversation.create({
      data: {
        isGroup: false,
      },
    });

    await prisma.conversationParticipant.createMany({
      data: [
        { conversationId: conv.id, userId: pair[0]!.id, role: "MEMBER" },
        { conversationId: conv.id, userId: pair[1]!.id, role: "MEMBER" },
      ],
    });

    // Send 3-6 messages
    for (let m = 0; m < faker.number.int({ min: 3, max: 6 }); m++) {
      const sender = m % 2 === 0 ? pair[0]! : pair[1]!;
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          senderId: sender.id,
          content: faker.lorem.sentence(),
        },
      });
    }
  }

  console.log("Seeding Notifications...");
  for (let i = 0; i < 15; i++) {
    const sender = faker.helpers.arrayElement(users);
    const receiver = faker.helpers.arrayElement(users.filter((u) => u.id !== sender.id));
    await prisma.notification.create({
      data: {
        receiverId: receiver.id,
        senderId: sender.id,
        type: faker.helpers.arrayElement(["FOLLOW", "COMMENT", "MESSAGE", "REACTION"]),
        isRead: faker.datatype.boolean(0.3),
      },
    });
  }

  console.log("Seeding Monetization...");
  // Creator tips
  await prisma.tip.create({
    data: {
      senderId: users[2]!.id,
      receiverId: creatorUser.id,
      amount: 15.00,
    },
  });

  // Creator Subscriptions
  await prisma.subscription.create({
    data: {
      subscriberId: users[3]!.id,
      creatorId: creatorUser.id,
      price: 4.99,
      status: "ACTIVE",
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  console.log("Seeding Feed Weight Config (default profile)...");
  const feedWeightDefaults = [
    { componentKey: "affinity",                 value: 0.30, description: "Weight for viewer→author affinity score",                minValue: 0, maxValue: 1 },
    { componentKey: "engagement",               value: 0.25, description: "Weight for predicted engagement probability",             minValue: 0, maxValue: 1 },
    { componentKey: "contentMatch",             value: 0.20, description: "Weight for topic/interest match score",                   minValue: 0, maxValue: 1 },
    { componentKey: "recency",                  value: 0.15, description: "Weight for freshness/recency decay score",                minValue: 0, maxValue: 1 },
    { componentKey: "coldStart",                value: 0.10, description: "Boost given to cold-start creator candidates",            minValue: 0, maxValue: 1 },
    { componentKey: "halfLifeHours",            value: 48,   description: "Recency half-life in hours (lower = fresher bias)",       minValue: 1, maxValue: 720 },
    { componentKey: "maxPerAuthor",             value: 2,    description: "Max posts per author per page in diversity pass",         minValue: 1, maxValue: 10 },
    { componentKey: "explorationSlotPct",       value: 0.10, description: "Fraction of feed positions reserved for exploration",    minValue: 0, maxValue: 0.5 },
    { componentKey: "trendingGuaranteedEvery",  value: 8,    description: "Insert a trending slot every N positions (0=disabled)",  minValue: 0, maxValue: 50 },
    { componentKey: "coldStartGuaranteedEvery", value: 10,   description: "Insert a cold-start slot every N positions (0=disabled)", minValue: 0, maxValue: 50 },
  ];
  const db = prisma as any;
  for (const w of feedWeightDefaults) {
    await db.feedWeightConfig.upsert({
      where: { profileName_componentKey: { profileName: "default", componentKey: w.componentKey } },
      update: { weightValue: w.value },
      create: { profileName: "default", componentKey: w.componentKey, weightValue: w.value },
    });
  }

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
