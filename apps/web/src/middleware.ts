import createMiddleware from "next-intl/middleware";
import NextAuth from "next-auth";
import { authConfig } from "@/server/auth/config";
import { locales, defaultLocale } from "@/i18n/config";
import type { NextRequest } from "next/server";

// next-intl locale routing middleware
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
});

// NextAuth middleware
const { auth } = NextAuth(authConfig);

export default async function middleware(request: NextRequest) {
  // Static files and API routes bypass i18n
  const { pathname } = request.nextUrl;

  const isPublicFile = /\.(.*)$/.test(pathname);
  const isApiRoute = pathname.startsWith("/api");
  const isNextInternal = pathname.startsWith("/_next");

  if (isPublicFile || isApiRoute || isNextInternal) {
    // Run only NextAuth for API routes
    return (auth as any)(request);
  }

  // For page routes, run next-intl middleware first (adds locale prefix)
  const intlResponse = intlMiddleware(request);
  if (intlResponse) return intlResponse;

  // Then run NextAuth
  return (auth as any)(request);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|uploads|static).*)"],
};
