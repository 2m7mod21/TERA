"use client";

import React, { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Shield, Mail, Lock, Loader2, ArrowRight } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setError("Invalid email or password. Please try again.");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleShortcut = (shortcutEmail: string) => {
    setEmail(shortcutEmail);
    setPassword("password123");
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-zinc-950 px-4 py-12 overflow-hidden">
      {/* Background ambient glows */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-violet-900/20 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-pink-900/10 blur-[120px]" />

      <div className="relative w-full max-w-md glass p-8 rounded-2xl shadow-2xl transition-all duration-300 hover:border-violet-600/30">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="gradient-btn p-3 rounded-2xl mb-4 shadow-lg shadow-violet-500/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Welcome to <span className="gradient-text">TERA</span>
          </h1>
          <p className="text-zinc-400 text-sm mt-2 text-center">
            The next-generation developer social media platform
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-450 p-4 rounded-xl text-center text-sm mb-6 animate-pulse">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl py-3 pl-10 pr-4 text-zinc-100 placeholder-zinc-500 transition-all outline-none"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
                Password
              </label>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl py-3 pl-10 pr-4 text-zinc-100 placeholder-zinc-500 transition-all outline-none"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full gradient-btn text-white font-bold py-3.5 px-4 rounded-xl shadow-lg flex items-center justify-center space-x-2 transition-all"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Shortcuts for Seed Accounts */}
        <div className="mt-8 pt-6 border-t border-zinc-900">
          <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block text-center mb-3">
            Quick Auto-Fill (Seeded Accounts)
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => handleShortcut("admin@tera.social")}
              className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 hover:border-violet-500/40 text-zinc-350 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
            >
              🔑 TERA Admin
            </button>
            <button
              onClick={() => handleShortcut("creator@tera.social")}
              className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 hover:border-pink-500/40 text-zinc-355 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
            >
              ✨ Jane The Creator
            </button>
          </div>
        </div>

        {/* Register helper link */}
        <div className="mt-8 text-center text-sm text-zinc-400">
          New to TERA?{" "}
          <Link
            href="/auth/register"
            className="text-violet-400 hover:text-violet-300 font-semibold cursor-pointer transition-colors"
          >
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="relative min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
