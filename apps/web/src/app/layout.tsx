import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/lib/providers";

export const metadata: Metadata = {
  title: "TERA | Next-Gen Social Media",
  description: "Connect, share, and monetize with the most advanced full-stack social media platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen text-slate-100 bg-zinc-950">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
