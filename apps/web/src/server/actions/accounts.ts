"use server";

import { auth } from "@/server/auth/config";
import crypto from "crypto";

export async function generateSwitchToken() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const secret = process.env.NEXTAUTH_SECRET || "fallback-secret";
  const payload = {
    userId: session.user.id,
    createdAt: Date.now(),
  };

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");

  return {
    success: true,
    token: `${header}.${body}.${signature}`,
  };
}
