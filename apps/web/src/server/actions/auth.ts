"use server";

import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { registerSchema } from "@/lib/utils";
import { TOTP } from "otpauth";
import QRCode from "qrcode";

export async function registerUser(formData: any) {
  const result = registerSchema.safeParse(formData);

  if (!result.success) {
    return { success: false, error: result.error.flatten().fieldErrors };
  }

  const { email, password, displayName, username, phone } = result.data;

  try {
    // Check if user exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { profile: { username } }
        ]
      }
    });

    if (existing) {
      return { success: false, error: { global: "Email or username already in use" } };
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        email,
        phone: phone || null,
        passwordHash,
        profile: {
          create: {
            displayName,
            username,
            avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`,
            privacyLevel: "PUBLIC",
          }
        }
      }
    });

    return { success: true };
  } catch (error: any) {
    console.error("Register user error:", error);
    return { success: false, error: { global: "Internal registration error" } };
  }
}

export async function verifyEmail(userId: string) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { isVerified: true }
    });
    return { success: true };
  } catch (error) {
    console.error("Verify email error:", error);
    return { success: false, error: "Failed to verify email" };
  }
}

export async function generate2FASecret(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Generate 32-char base32 secret
    const secret = Math.random().toString(36).substring(2, 10).toUpperCase() + 
                   Math.random().toString(36).substring(2, 10).toUpperCase();

    const totp = new TOTP({
      issuer: "TERA Social",
      label: user.email || user.profile?.username || "user",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: secret,
    });

    const otpAuthUrl = totp.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    // Save temporary secret to database
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret }
    });

    return { success: true, secret, qrCodeDataUrl };
  } catch (error: any) {
    console.error("Generate 2FA error:", error);
    return { success: false, error: "Failed to set up 2FA" };
  }
}

export async function verifyAndEnable2FA(userId: string, code: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user || !user.twoFactorSecret) {
      return { success: false, error: "2FA setup was not initialized" };
    }

    const totp = new TOTP({
      issuer: "TERA Social",
      label: user.email || user.profile?.username || "user",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: user.twoFactorSecret,
    });

    const delta = totp.validate({ token: code, window: 1 });

    if (delta === null) {
      return { success: false, error: "Invalid verification code" };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true }
    });

    return { success: true };
  } catch (error) {
    console.error("Verify 2FA error:", error);
    return { success: false, error: "Failed to verify 2FA code" };
  }
}

export async function disable2FA(userId: string) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null
      }
    });
    return { success: true };
  } catch (error) {
    console.error("Disable 2FA error:", error);
    return { success: false, error: "Failed to disable 2FA" };
  }
}
