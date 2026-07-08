"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { statSync } from "fs";
import path from "path";
import os from "os";

export async function getSystemMetrics() {
  await requireAdmin("systemMonitor", "read");

  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  // Try to get DB file size
  let dbSizeMb = 0;
  try {
    const dbPath = path.join(process.cwd(), "prisma", "dev.db");
    const stat = statSync(dbPath);
    dbSizeMb = stat.size / (1024 * 1024);
  } catch {
    // DB path may differ in production
  }

  // Job queue stats
  const jobStats = await prisma.jobQueue.groupBy({
    by: ["status"],
    _count: { status: true },
  });
  const jobMap = Object.fromEntries(jobStats.map((j) => [j.status, j._count.status]));

  return {
    memory: {
      heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMb: Math.round(memUsage.rss / 1024 / 1024),
    },
    cpu: {
      userMs: Math.round(cpuUsage.user / 1000),
      systemMs: Math.round(cpuUsage.system / 1000),
    },
    dbSizeMb: Math.round(dbSizeMb * 100) / 100,
    osPlatform: os.platform(),
    osUptime: Math.round(os.uptime() / 3600), // hours
    jobs: {
      pending: jobMap["PENDING"] || 0,
      running: jobMap["RUNNING"] || 0,
      done: jobMap["DONE"] || 0,
      failed: jobMap["FAILED"] || 0,
    },
  };
}

export async function getDatabaseInfo() {
  await requireAdmin("database", "read");

  // SQLite: count rows per table using Prisma
  const [
    userCount,
    postCount,
    commentCount,
    reactionCount,
    reportCount,
    messageCount,
    auditLogCount,
    analyticsCount,
    jobQueueCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.comment.count(),
    prisma.reaction.count(),
    prisma.report.count(),
    prisma.message.count(),
    prisma.adminAuditLog.count(),
    prisma.analyticsEvent.count(),
    prisma.jobQueue.count(),
  ]);

  return {
    tables: [
      { name: "User", count: userCount },
      { name: "Post", count: postCount },
      { name: "Comment", count: commentCount },
      { name: "Reaction", count: reactionCount },
      { name: "Report", count: reportCount },
      { name: "Message", count: messageCount },
      { name: "AdminAuditLog", count: auditLogCount },
      { name: "AnalyticsEvent", count: analyticsCount },
      { name: "JobQueue", count: jobQueueCount },
    ],
  };
}
