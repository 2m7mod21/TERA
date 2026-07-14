"use client";

import React, { useState, useTransition } from "react";
import { Bell, Send } from "lucide-react";
import { getMassNotifications, sendMassNotification } from "@/server/actions/admin/notifications";

export default function NotificationsClient({
  initialItems,
  initialCursor,
}: {
  initialItems: any[];
  initialCursor: string | null;
}) {
  const [items, setItems] = useState<any[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);

  // Form states
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<"ALL" | "VERIFIED" | "INACTIVE_30">("ALL");
  const [scheduledAt, setScheduledAt] = useState("");

  const [isPending, startTransition] = useTransition();

  const handleFetch = (reset = false) => {
    startTransition(async () => {
      const res = await getMassNotifications(reset ? undefined : (cursor || undefined));
      if (reset) setItems(res.items);
      else setItems((prev) => [...prev, ...res.items]);
      setCursor(res.nextCursor);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) return alert("Title and Body are required.");

    startTransition(async () => {
      const res = await sendMassNotification({
        title,
        body,
        target,
        scheduledAt: scheduledAt || undefined,
      });

      if (res.success) {
        alert("Broadcast mass notification scheduled/queued successfully!");
        setTitle("");
        setBody("");
        setScheduledAt("");
        handleFetch(true);
      } else {
        alert("Broadcast failed.");
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Mass Notification Panel</h1>
        <p className="text-xs text-slate-500">Send system notices, security warnings, or platform announcements to target audiences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Broadcast Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 glass border border-white/5 p-6 rounded-2xl bg-white/[0.01] space-y-4">
          <h3 className="text-sm font-bold text-slate-350 flex items-center gap-2">
            <Send className="w-4 h-4 text-violet-400" /> Dispatch System Notice
          </h3>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Platform Maintenance Notice"
              className="w-full px-3 py-2 bg-[#0d0d14] border border-white/5 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-violet-500"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Body Content</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Enter message details to send to targeted members..."
              className="w-full px-3 py-2 bg-[#0d0d14] border border-white/5 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-violet-500 resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Target Group</label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value as any)}
                className="w-full px-3 py-2 bg-[#0d0d14] border border-white/5 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-violet-500"
              >
                <option value="ALL">All Registered Members</option>
                <option value="VERIFIED">Verified Badge Members Only</option>
                <option value="INACTIVE_30">Inactive (Last 30 Days)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Schedule Launch (Optional)</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 bg-[#0d0d14] border border-white/5 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-violet-605 border border-violet-500/20 hover:bg-violet-600 text-xs font-bold text-white transition-colors"
            disabled={isPending}
          >
            <Send className="w-3.5 h-3.5" />
            {isPending ? "Queuing Notice..." : "Dispatch Broadcast Now"}
          </button>
        </form>

        {/* History Stream */}
        <div className="glass border border-white/5 p-5 rounded-2xl bg-white/[0.01] flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
              <Bell className="w-4 h-4 text-violet-400" /> Notifications Logs
            </h3>

            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-xs text-slate-500">Broadcast history is empty.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {items.map((it) => (
                  <div key={it.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-slate-500">
                      <span className="font-bold text-violet-455">To: {it.target}</span>
                      <span>{new Date(it.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="font-bold text-slate-205">{it.title}</p>
                    <p className="text-[10px] text-slate-450 line-clamp-2">{it.body}</p>
                    <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-slate-400 mt-1.5">
                      {it.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cursor && (
            <button
              onClick={() => handleFetch(false)}
              className="mt-3 w-full py-1.5 rounded-lg border border-white/5 bg-white/5 text-xs text-slate-400"
              disabled={isPending}
            >
              Load Older Notices
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
