"use client";

import React, { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Shield, Mail, Lock, Loader2, ArrowRight, Eye, EyeOff, 
  Sparkles, MessageSquare, Users, Star, Code
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 lg:grid lg:grid-cols-12 relative overflow-hidden">
      {/* Decorative gradient background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-900/10 blur-[140px] pointer-events-none" />

      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f2e_1px,transparent_1px),linear-gradient(to_bottom,#1f1f2e_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-[0.06] pointer-events-none" />

      {/* Left Column: Visual Brand/Promo Panel (hidden on mobile, visible on lg) */}
      <div className="lg:col-span-5 hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-zinc-900 via-zinc-950 to-violet-950/20 border-r border-zinc-800/40 relative overflow-hidden">
        {/* Glow behind logo */}
        <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-violet-500/15 blur-[60px]" />
        
        {/* Logo and Brand */}
        <div className="relative flex items-center gap-3">
          <div className="gradient-btn p-2.5 rounded-2xl shadow-xl shadow-violet-500/10 border border-violet-400/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-extrabold tracking-tight uppercase">
            TERA<span className="text-violet-500">.</span>social
          </span>
        </div>

        {/* Feature Teasers */}
        <div className="relative space-y-8 my-auto max-w-sm">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Next-Gen Platform</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white leading-tight">
              Connect & Share with developers worldwide.
            </h2>
          </div>

          <div className="space-y-6 pt-4">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                <Code className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-200">Developer First</h4>
                <p className="text-xs text-zinc-400 mt-1">Rich code styling, custom syntax tags, and API integrations.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-200">Real-Time Interaction</h4>
                <p className="text-xs text-zinc-400 mt-1">Fast sub-second notifications, rooms, and chat features.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-200">Automated Moderation</h4>
                <p className="text-xs text-zinc-400 mt-1">Advanced content filtering to ensure community safety.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info/stats */}
        <div className="relative pt-6 border-t border-zinc-800/40 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 fill-violet-500/20 text-violet-400" />
            <span>Trusted by creators global</span>
          </div>
          <span>v1.2.0</span>
        </div>
      </div>

      {/* Right Column: Login Portal Form */}
      <div className="lg:col-span-7 flex flex-col items-center justify-center p-6 sm:p-12 relative min-h-screen lg:min-h-0">
        
        {/* Brand header for mobile only */}
        <div className="lg:hidden flex flex-col items-center mb-8">
          <div className="gradient-btn p-3 rounded-2xl mb-4 shadow-lg shadow-violet-500/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Welcome to <span className="gradient-text">TERA</span>
          </h1>
          <p className="text-zinc-400 text-sm mt-2 text-center">
            The premium developer social media platform
          </p>
        </div>

        {/* Primary Glassmorphic container */}
        <div className="w-full max-w-[420px] bg-zinc-900/30 backdrop-blur-md border border-zinc-800/80 p-8 rounded-3xl shadow-2xl space-y-6">
          <div className="hidden lg:block space-y-1">
            <h3 className="text-2xl font-bold text-white tracking-tight">Sign In</h3>
            <p className="text-xs text-zinc-400">Enter your credentials to access your account</p>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3.5 rounded-2xl text-center text-xs animate-pulse">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 block">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-550">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  className="w-full bg-zinc-950/70 border border-zinc-800 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 rounded-2xl py-3 pl-10 pr-4 text-xs text-zinc-100 placeholder-zinc-600 transition-all outline-none"
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-zinc-400 block">
                  Password
                </label>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-555">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full bg-zinc-950/70 border border-zinc-800 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 rounded-2xl py-3 pl-10 pr-10 text-xs text-zinc-100 placeholder-zinc-600 transition-all outline-none"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3.5 px-4 rounded-2xl shadow-xl flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span className="text-xs">Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Register link */}
          <div className="text-center text-xs text-zinc-500 pt-2">
            Don't have an TERA account?{" "}
            <Link
              href="/auth/register"
              className="text-violet-400 hover:text-violet-300 font-semibold cursor-pointer transition-colors"
            >
              Create Account
            </Link>
          </div>
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
