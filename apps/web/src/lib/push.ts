/**
 * TERA Push Notification Server Utilities
 * Sends Web Push notifications to subscribed devices.
 */
import webpush from "web-push";
import { prisma } from "@/lib/db";

// ─── VAPID Configuration ─────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@tera.social";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// ─── Notification Payload Shapes ─────────────────────────────────────────────
export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  type?: string;
  icon?: string;
  badge?: string;
}

// ─── Send Push to one User (all their devices) ───────────────────────────────
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    // VAPID keys not configured — silently skip
    return;
  }

  let subs: any[];
  try {
    subs = await (prisma as any).pushSubscription.findMany({
      where: { userId },
    });
  } catch {
    return;
  }

  if (!subs || subs.length === 0) return;

  const message = JSON.stringify({
    ...payload,
    icon: payload.icon ?? "/icon-192.png",
    badge: payload.badge ?? "/badge-72.png",
  });

  const results = await Promise.allSettled(
    subs.map((sub: any) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        message,
        { TTL: 86400 } // 24h
      )
    )
  );

  // Remove expired subscriptions (HTTP 410 Gone)
  const expiredEndpoints: string[] = [];
  results.forEach((result, i) => {
    if (
      result.status === "rejected" &&
      (result.reason as any)?.statusCode === 410
    ) {
      expiredEndpoints.push(subs[i].endpoint);
    }
  });

  if (expiredEndpoints.length > 0) {
    await (prisma as any).pushSubscription.deleteMany({
      where: { endpoint: { in: expiredEndpoints } },
    });
  }
}

// ─── Notification title / body builder ────────────────────────────────────────
export function buildPushPayload(
  type: string,
  senderName: string,
  entityUrl = "/"
): PushPayload {
  const LABELS: Record<string, string> = {
    FOLLOW: `${senderName} started following you`,
    REACTION: `${senderName} liked your post`,
    COMMENT: `${senderName} commented on your post`,
    REPLY: `${senderName} replied to your comment`,
    MENTION: `${senderName} mentioned you`,
    MESSAGE: `${senderName} sent you a message`,
    STORY_REACTION: `${senderName} reacted to your story`,
    STORY_VIEW: `${senderName} viewed your story`,
    STORY_REPLY: `${senderName} replied to your story`,
    ACCOUNT_VERIFIED: "Your account has been verified! 🎉",
    SECURITY_ALERT: "Security alert on your account",
    SYSTEM: "You have a new notification from TERA",
  };

  return {
    title: "TERA",
    body: LABELS[type] ?? `${senderName} interacted with your content`,
    url: entityUrl,
    tag: `tera-${type.toLowerCase()}`,
    type,
  };
}
