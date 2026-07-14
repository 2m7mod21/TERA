import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales, isRTL } from "@/i18n/config";
import "../globals.css";
import { Providers } from "@/lib/providers";

export const metadata: Metadata = {
  title: "TERA | Next-Gen Social Media",
  description: "Connect, share, and monetize with the most advanced full-stack social media platform.",
  alternates: {
    canonical: "/",
    languages: {
      "x-default": "/en",
      en: "/en",
      ar: "/ar",
      fr: "/fr",
    },
  },
};

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function RootLayout({ children, params }: LayoutProps) {
  const { locale } = await params;

  // Validate locale
  if (!locales.includes(locale as any)) {
    notFound();
  }

  // Retrieve translation messages for this locale
  const messages = await getMessages();
  const dir = isRTL(locale) ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} className="dark">
      <body className="antialiased min-h-screen text-slate-100 bg-zinc-950">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
