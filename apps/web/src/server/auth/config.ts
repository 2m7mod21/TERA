import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Github from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { loginSchema } from "@/lib/utils";

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
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage = nextUrl.pathname.startsWith("/auth");
      const isAdminPage = nextUrl.pathname.startsWith("/admin");

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
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
