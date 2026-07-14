"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerUser } from "@/server/actions/auth";
import { 
  Shield, Mail, Lock, User, AtSign, Loader2, ArrowRight, Eye, EyeOff, 
  Sparkles, Globe, Award
} from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError({});
    setSuccess(false);

    try {
      const res = await registerUser({
        email,
        password,
        displayName,
        username,
      }) as any;

      if (!res.success) {
        if (typeof res.error === "string") {
          setError({ global: res.error });
        } else if (res.error) {
          setError(res.error as Record<string, string>);
        } else {
          setError({ global: "Registration failed. Try registering with different details." });
        }
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push("/auth/login");
        }, 2000);
      }
    } catch (err) {
      setError({ global: "An unexpected error occurred during signup." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 lg:grid lg:grid-cols-12 relative overflow-hidden">
      {/* Decorative gradient background glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full bg-pink-900/10 blur-[140px] pointer-events-none" />

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
              <span>Free Account Registration</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white leading-tight">
              Create your developer presence in seconds.
            </h2>
          </div>

          <div className="space-y-6 pt-4">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                <AtSign className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-200">Claim your Username</h4>
                <p className="text-xs text-zinc-400 mt-1">Reserve your unique handle, build your custom portfolio card, and start writing.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                <Award className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-200">Verified Badges</h4>
                <p className="text-xs text-zinc-400 mt-1">Connect your verified developer profile status to your post signature.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                <Globe className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-200">Decentralized Networking</h4>
                <p className="text-xs text-zinc-400 mt-1">Express thoughts, create polls, post media, and build open source community groups.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info/stats */}
        <div className="relative pt-6 border-t border-zinc-800/40 flex items-center justify-between text-xs text-zinc-500">
          <span>Decentralized & Safe</span>
          <span>v1.2.0</span>
        </div>
      </div>

      {/* Right Column: Register Form */}
      <div className="lg:col-span-7 flex flex-col items-center justify-center p-6 sm:p-12 relative min-h-screen lg:min-h-0">
        
        {/* Brand header for mobile only */}
        <div className="lg:hidden flex flex-col items-center mb-8">
          <div className="gradient-btn p-3 rounded-2xl mb-4 shadow-lg shadow-violet-500/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Create <span className="gradient-text">TERA</span> Account
          </h1>
          <p className="text-zinc-400 text-sm mt-2 text-center">
            Sign up to showcase your developer bio, posts, and connect
          </p>
        </div>

        {/* Primary Glassmorphic container */}
        <div className="w-full max-w-[420px] bg-zinc-900/30 backdrop-blur-md border border-zinc-800/80 p-8 rounded-3xl shadow-2xl space-y-6">
          
          <div className="hidden lg:block space-y-1">
            <h3 className="text-2xl font-bold text-white tracking-tight">Create Account</h3>
            <p className="text-xs text-zinc-400">Join the exclusive social portal for developers</p>
          </div>

          {success ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-6 rounded-2xl text-center space-y-3">
              <h3 className="font-bold text-base">Registration Successful!</h3>
              <p className="text-xs text-zinc-400">Redirecting to login portal...</p>
              <Loader2 className="w-5 h-5 animate-spin mx-auto mt-4 text-emerald-450" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error.global && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3.5 rounded-2xl text-center text-xs">
                  {error.global}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400 block">
                  Display Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-550">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    className="w-full bg-zinc-950/70 border border-zinc-800 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 rounded-2xl py-3 pl-10 pr-4 text-xs text-zinc-100 placeholder-zinc-650 transition-all outline-none"
                    placeholder="e.g. John Doe"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                {error.displayName && (
                  <p className="text-rose-400 text-[10px] mt-1">{error.displayName}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400 block">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-550">
                    <AtSign className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    className="w-full bg-zinc-950/70 border border-zinc-800 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 rounded-2xl py-3 pl-10 pr-4 text-xs text-zinc-100 placeholder-zinc-655 transition-all outline-none"
                    placeholder="e.g. johndoe"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                {error.username && (
                  <p className="text-rose-400 text-[10px] mt-1">{error.username}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400 block">
                  Email
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-550">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    className="w-full bg-zinc-950/70 border border-zinc-800 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 rounded-2xl py-3 pl-10 pr-4 text-xs text-zinc-100 placeholder-zinc-650 transition-all outline-none"
                    placeholder="john@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {error.email && (
                  <p className="text-rose-400 text-[10px] mt-1">{error.email}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400 block">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-550">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full bg-zinc-950/70 border border-zinc-800 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 rounded-2xl py-3 pl-10 pr-10 text-xs text-zinc-100 placeholder-zinc-650 transition-all outline-none"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-550 hover:text-zinc-350 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {error.password && (
                  <p className="text-rose-400 text-[10px] mt-1">{error.password}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3.5 px-4 rounded-2xl shadow-xl mt-3 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span className="text-xs">Create Account</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Login helper link */}
          <div className="text-center text-xs text-zinc-500 pt-2">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-violet-400 hover:text-violet-300 font-semibold cursor-pointer transition-colors"
            >
              Sign in instead
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
