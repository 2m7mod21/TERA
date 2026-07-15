import { NextResponse } from "next/server";
import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db";

/** GET /api/push/vapid-key — Returns the public VAPID key for the client */
export async function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) {
    return NextResponse.json({ error: "Push not configured" }, { status: 503 });
  }
  return NextResponse.json({ publicKey: key });
}

/** POST /api/push/vapid-key — Subscribe a device */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { endpoint, keys } = body;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent") ?? undefined;

  await (prisma as any).pushSubscription.upsert({
    where: { endpoint },
    update: {
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent,
      updatedAt: new Date(),
    },
    create: {
      userId: session.user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent,
    },
  });

  return NextResponse.json({ success: true });
}

/** DELETE /api/push/vapid-key — Unsubscribe a device */
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { endpoint } = body;

  if (endpoint) {
    await (prisma as any).pushSubscription.deleteMany({
      where: { endpoint, userId: session.user.id },
    });
  }

  return NextResponse.json({ success: true });
}
