"use client";

import React, { useState, useTransition, useRef } from "react";
import {
  X, AlertTriangle, Shield, MessageSquare, Trash2, Flag,
  DollarSign, Camera, ChevronRight, CheckCircle, Loader2,
} from "lucide-react";
import { submitReport } from "@/server/actions/report";

// ── Categories & Reasons ──────────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: "SAFETY",
    label: "Safety Issues",
    icon: AlertTriangle,
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    reasons: [
      { id: "VIOLENCE", label: "Violence or graphic content" },
      { id: "THREATS", label: "Credible threats or intimidation" },
      { id: "TERRORISM", label: "Terrorism or extremism" },
      { id: "SELF_HARM", label: "Self-harm or suicide" },
      { id: "DANGEROUS_ACTIVITIES", label: "Dangerous activities" },
    ],
  },
  {
    id: "ABUSE",
    label: "Harassment & Abuse",
    icon: Shield,
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
    reasons: [
      { id: "HARASSMENT", label: "Harassment or bullying" },
      { id: "HATE_SPEECH", label: "Hate speech or discrimination" },
      { id: "TARGETED_ATTACK", label: "Targeted attack or doxxing" },
    ],
  },
  {
    id: "SPAM",
    label: "Spam & Fake Activity",
    icon: MessageSquare,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    reasons: [
      { id: "SPAM", label: "Spam or repeated content" },
      { id: "FAKE_ENGAGEMENT", label: "Fake likes / followers" },
      { id: "BOT_ACTIVITY", label: "Automated bot behavior" },
    ],
  },
  {
    id: "FRAUD",
    label: "Fraud & Scams",
    icon: DollarSign,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    reasons: [
      { id: "SCAM", label: "Scam or deceptive offer" },
      { id: "PHISHING", label: "Phishing or credential theft" },
      { id: "FINANCIAL_FRAUD", label: "Financial fraud" },
    ],
  },
  {
    id: "SEXUAL",
    label: "Sexual Content",
    icon: Camera,
    color: "text-pink-400",
    bg: "bg-pink-500/10 border-pink-500/20",
    reasons: [
      { id: "NUDITY", label: "Nudity or explicit content" },
      { id: "SEXUAL_EXPLOITATION", label: "Sexual exploitation" },
    ],
  },
  {
    id: "IP",
    label: "Intellectual Property",
    icon: Flag,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    reasons: [
      { id: "COPYRIGHT", label: "Copyright violation" },
      { id: "TRADEMARK", label: "Trademark infringement" },
    ],
  },
  {
    id: "OTHER",
    label: "Other",
    icon: Trash2,
    color: "text-zinc-400",
    bg: "bg-zinc-500/10 border-zinc-500/20",
    reasons: [{ id: "OTHER", label: "Other violation" }],
  },
];

type ContentType = "POST" | "COMMENT" | "MESSAGE" | "USER" | "STORY" | "REEL";

interface ReportModalProps {
  contentType: ContentType;
  contentId: string;
  reportedUserId?: string;
  contentLabel?: string;
  onClose: () => void;
}

export default function ReportModal({
  contentType,
  contentId,
  reportedUserId,
  contentLabel,
  onClose,
}: ReportModalProps) {
  const [step, setStep] = useState<"category" | "reason" | "details" | "done">("category");
  const [selectedCategory, setSelectedCategory] = useState<(typeof CATEGORIES)[0] | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleSubmit = () => {
    if (!selectedCategory || !selectedReason) return;
    startTransition(async () => {
      setError(null);
      const res = await submitReport({
        contentType,
        contentId,
        reportedUserId,
        category: selectedCategory.id as any,
        reason: selectedReason,
        details: details.trim() || undefined,
      });
      if (res && res.success) {
        setReportId(res.reportId ?? null);
        setStep("done");
      } else {
        const errMsg = res && typeof res.error === "string"
          ? res.error
          : typeof res?.error === "object" && res?.error !== null
          ? JSON.stringify(res.error)
          : "Submission failed. Please try again.";
        setError(errMsg);
      }
    });
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-rose-400" />
            <h2 className="font-bold text-sm text-white">
              Report {contentLabel ?? contentType.charAt(0) + contentType.slice(1).toLowerCase()}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex px-5 pt-3 gap-1.5">
          {["category", "reason", "details"].map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                step === s
                  ? "bg-violet-500"
                  : ["category", "reason", "details"].indexOf(step) > i
                  ? "bg-violet-500/40"
                  : "bg-zinc-800"
              }`}
            />
          ))}
        </div>

        {/* ── Step: Category ── */}
        {step === "category" && (
          <div className="p-5 space-y-2">
            <p className="text-xs text-zinc-400 mb-3">What's the issue with this content?</p>
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setStep("reason");
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all hover:border-violet-500/40 hover:bg-violet-500/5 ${cat.bg}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${cat.color}`} />
                    <span className="text-sm font-medium text-zinc-200">{cat.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                </button>
              );
            })}
          </div>
        )}

        {/* ── Step: Reason ── */}
        {step === "reason" && selectedCategory && (
          <div className="p-5 space-y-2">
            <button
              onClick={() => setStep("category")}
              className="text-xs text-violet-400 mb-1 flex items-center gap-1 hover:text-violet-300"
            >
              ← {selectedCategory.label}
            </button>
            <p className="text-xs text-zinc-400 mb-3">Select the specific reason:</p>
            {selectedCategory.reasons.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setSelectedReason(r.id);
                  setStep("details");
                }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-zinc-800 text-left hover:border-violet-500/40 hover:bg-violet-500/5 transition-all"
              >
                <span className="text-sm text-zinc-200">{r.label}</span>
                <ChevronRight className="w-4 h-4 text-zinc-600" />
              </button>
            ))}
          </div>
        )}

        {/* ── Step: Details ── */}
        {step === "details" && (
          <div className="p-5 space-y-4">
            <button
              onClick={() => setStep("reason")}
              className="text-xs text-violet-400 flex items-center gap-1 hover:text-violet-300"
            >
              ← Back
            </button>
            <div>
              <p className="text-xs font-semibold text-zinc-300 mb-1">Additional details (optional)</p>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="Describe the issue in more detail. The more context you provide, the faster our team can review it."
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none resize-none transition-all"
              />
              <p className="text-right text-[10px] text-zinc-600 mt-1">{details.length}/1000</p>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="w-full gradient-btn text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            >
              {isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
              ) : (
                <><Flag className="w-4 h-4" /> Submit Report</>
              )}
            </button>
          </div>
        )}

        {/* ── Step: Done ── */}
        {step === "done" && (
          <div className="p-8 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Report Submitted</h3>
              <p className="text-xs text-zinc-400 mt-2 max-w-sm">
                Thank you for keeping TERA safe. Our moderation team will review your report and take
                appropriate action.
              </p>
              {reportId && (
                <p className="text-[10px] text-zinc-600 mt-3 font-mono">
                  Report ID: {reportId.slice(0, 8).toUpperCase()}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm font-semibold text-zinc-300 hover:text-white hover:border-zinc-700 transition-all"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
