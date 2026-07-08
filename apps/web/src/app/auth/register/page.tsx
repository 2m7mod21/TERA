"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerUser } from "@/server/actions/auth";
import { Shield, Mail, Lock, User, AtSign, Loader2, ArrowRight } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
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
    <div className="relative min-h-screen flex items-center justify-center bg-zinc-950 px-4 py-8 overflow-hidden">
      <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-violet-900/20 blur-[120px]" />
      <div className="absolute bottom-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-pink-900/10 blur-[120px]" />

      <div className="relative w-full max-w-md glass p-8 rounded-2xl shadow-2xl transition-all duration-300 hover:border-violet-600/30">
        <div className="flex flex-col items-center mb-8">
          <div className="gradient-btn p-3 rounded-2xl mb-4 shadow-lg shadow-violet-500/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Create <span className="gradient-text">TERA</span> Account
          </h1>
          <p className="text-zinc-400 text-sm mt-2 text-center">
            Join the decentralized community of creators and developers
          </p>
        </div>

        {success ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-6 rounded-2xl text-center space-y-2">
            <h3 className="font-bold text-lg">Registration Successful!</h3>
            <p className="text-sm text-zinc-400">Redirecting to login portal...</p>
            <Loader2 className="w-6 h-6 animate-spin mx-auto mt-4 text-emerald-450" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error.global && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-450 p-4 rounded-xl text-center text-sm">
                {error.global}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
                Display Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl py-3 pl-10 pr-4 text-zinc-100 placeholder-zinc-500 transition-all outline-none"
                  placeholder="John Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              {error.displayName && (
                <p className="text-rose-450 text-xs mt-1">{error.displayName}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
                Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                  <AtSign className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl py-3 pl-10 pr-4 text-zinc-100 placeholder-zinc-500 transition-all outline-none"
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              {error.username && (
                <p className="text-rose-450 text-xs mt-1">{error.username}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
                Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl py-3 pl-10 pr-4 text-zinc-100 placeholder-zinc-500 transition-all outline-none"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {error.email && (
                <p className="text-rose-450 text-xs mt-1">{error.email}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
                Password
              </label>
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
              {error.password && (
                <p className="text-rose-450 text-xs mt-1">{error.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full gradient-btn text-white font-bold py-3.5 px-4 rounded-xl shadow-lg mt-3 flex items-center justify-center space-x-2 transition-all"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-8 text-center text-sm text-zinc-400">
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
  );
}
