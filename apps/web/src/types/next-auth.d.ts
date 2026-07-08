import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      isAdmin: boolean;
      isVerified: boolean;
      verifiedBadge: boolean;
      twoFactorEnabled: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    username?: string;
    isAdmin?: boolean;
    isVerified?: boolean;
    verifiedBadge?: boolean;
    twoFactorEnabled?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    username?: string;
    isAdmin?: boolean;
    isVerified?: boolean;
    verifiedBadge?: boolean;
    twoFactorEnabled?: boolean;
  }
}
