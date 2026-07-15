import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Github from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { loginSchema } from "@/lib/utils";
import crypto from "crypto";

export const authConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || "static-placeholder",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "static-placeholder",
    }),
    Github({
      clientId: process.env.GITHUB_CLIENT_ID || "static-placeholder",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "static-placeholder",
    }),
    Credentials({
      async authorize(credentials) {
        if (credentials?.switchToken && credentials?.userId) {
          try {
            const token = credentials.switchToken as string;
            const targetUserId = credentials.userId as string;
            const secret = process.env.NEXTAUTH_SECRET || "fallback-secret";
            const [header, body, signature] = token.split(".");
            if (!header || !body || !signature) return null;
            const expectedSig = crypto
              .createHmac("sha256", secret)
              .update(`${header}.${body}`)
              .digest("base64url");
            if (signature === expectedSig) {
              const payload = JSON.parse(Buffer.from(body, "base64url").toString());
              if (payload.userId === targetUserId) {
                const user = await prisma.user.findUnique({
                  where: { id: targetUserId },
                  include: { profile: true }
                });
                if (user) {
                  return {
                    id: user.id,
                    email: user.email,
                    name: user.profile?.displayName || user.email,
                    image: user.profile?.avatarUrl,
                  };
                }
              }
            }
          } catch (e) {
            console.error("Token switch authorization failed", e);
          }
          return null;
        }

        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email },
              { profile: { username: email } }
            ]
          },
          include: { profile: true }
        });

        if (!user || !user.passwordHash) return null;

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) return null;

        // Clean user object for NextAuth session
        return {
          id: user.id,
          email: user.email,
          name: user.profile?.displayName || user.email,
          image: user.profile?.avatarUrl,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        // Find supplementary info on first sign-in
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          include: { profile: true }
        });

        if (dbUser) {
          token.userId = dbUser.id;
          token.username = dbUser.profile?.username || "";
          token.isAdmin = dbUser.isAdmin;
          token.isVerified = dbUser.isVerified;
          token.verifiedBadge = dbUser.verifiedBadge;
          token.twoFactorEnabled = dbUser.twoFactorEnabled;
          token.isBanned = dbUser.isBanned;
          token.isSuspended = dbUser.isSuspended;
          token.picture = dbUser.profile?.avatarUrl || "";
        }
      }

      // On every token refresh (not just sign-in), re-check ban/suspend status from DB
      // This ensures a ban takes effect within one token TTL cycle (~30s by default)
      if (!user && token.userId) {
        try {
          const freshUser = await prisma.user.findUnique({
            where: { id: token.userId as string },
            select: {
              isBanned: true,
              isSuspended: true,
              isAdmin: true,
              verifiedBadge: true,
              profile: {
                select: {
                  avatarUrl: true
                }
              }
            },
          });
          if (freshUser) {
            token.isBanned = freshUser.isBanned;
            token.isSuspended = freshUser.isSuspended;
            token.isAdmin = freshUser.isAdmin;
            token.verifiedBadge = freshUser.verifiedBadge;
            token.picture = freshUser.profile?.avatarUrl || "";
          } else {
            // User was deleted — invalidate token
            return null as any;
          }
        } catch {
          // DB error — keep existing token to avoid mass logouts on transient errors
        }
      }

      if (trigger === "update" && session) {
        token = { ...token, ...session };
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.userId as string;
        session.user.username = token.username as string;
        session.user.isAdmin = token.isAdmin as boolean;
        session.user.isVerified = token.isVerified as boolean;
        session.user.verifiedBadge = token.verifiedBadge as boolean;
        session.user.twoFactorEnabled = token.twoFactorEnabled as boolean;
        session.user.isBanned = token.isBanned as boolean;
        session.user.isSuspended = token.isSuspended as boolean;
        session.user.image = (token.picture || token.image) as string;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage = nextUrl.pathname.startsWith("/auth");
      const isAdminPage = nextUrl.pathname.startsWith("/admin");

      // Always allow access to banned/suspended notice pages
      if (
        nextUrl.pathname === "/auth/banned" ||
        nextUrl.pathname === "/auth/suspended"
      ) {
        return true;
      }

      // Force banned users off the platform immediately
      if (isLoggedIn && auth.user.isBanned) {
        return Response.redirect(new URL("/auth/banned", nextUrl));
      }

      // Force suspended users off the platform
      if (isLoggedIn && auth.user.isSuspended) {
        return Response.redirect(new URL("/auth/suspended", nextUrl));
      }

      if (isAuthPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      if (isAdminPage) {
        if (!isLoggedIn) return false;
        return !!auth.user.isAdmin;
      }

      // Check standard route protection
      const isPublicRoute = 
        nextUrl.pathname === "/explore" ||
        nextUrl.pathname.startsWith("/api") || 
        nextUrl.pathname.startsWith("/static") ||
        nextUrl.pathname.startsWith("/uploads");

      if (!isLoggedIn && !isPublicRoute) {
        let callbackUrl = nextUrl.pathname;
        if (nextUrl.search) callbackUrl += nextUrl.search;
        return Response.redirect(new URL(`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`, nextUrl));
      }

      return true;
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? `__Secure-authjs.session-token` : `authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60, // 30 days persistent cookie
      },
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
