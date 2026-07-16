"use client";

import React, { useState, useTransition } from "react";
import { Headphones, MessageSquare } from "lucide-react";
import { getSupportTickets, getTicketMessages, replyToTicket, resolveTicket } from "@/server/actions/admin/notifications";

export default function SupportClient({
  initialTickets,
  initialCursor,
}: {
  initialTickets: any[];
  initialCursor: string | null;
}) {
  const [tickets, setTickets] = useState<any[]>(initialTickets);
  const [cursor, setCursor] = useState<string | null>(initialCursor);

  // Active chat state
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  
  const [isPending, startTransition] = useTransition();

  const handleFetch = (reset = false) => {
    startTransition(async () => {
      const res = await getSupportTickets(undefined, reset ? undefined : (cursor || undefined));
      if (reset) setTickets(res.tickets);
      else setTickets((prev) => [...prev, ...res.tickets]);
      setCursor(res.nextCursor);
    });
  };

  const handleSelectTicket = (ticket: any) => {
    setActiveTicket(ticket);
    startTransition(async () => {
      const msgs = await getTicketMessages(ticket.id);
      setMessages(msgs);
    });
  };

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText || !activeTicket) return;

    startTransition(async () => {
      const res = await replyToTicket(activeTicket.id, replyText);
      if (res.success) {
        setReplyText("");
        // Reload messages
        const msgs = await getTicketMessages(activeTicket.id);
        setMessages(msgs);
        handleFetch(true);
      }
    });
  };

  const handleResolve = (ticketId: string) => {
    if (!confirm("Are you sure you want to mark this support ticket as RESOLVED?")) return;
    startTransition(async () => {
      const res = await resolveTicket(ticketId);
      if (res.success) {
        setActiveTicket(null);
        handleFetch(true);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Support Center</h1>
        <p className="text-xs text-slate-500">Coordinate and resolve user reported assistance and billing request tickets.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket List */}
        <div className="glass border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
          <div className="p-4 border-b border-white/5 bg-white/[0.02]">
            <h3 className="text-xs font-bold text-slate-350 uppercase tracking-widest">Active Tickets</h3>
          </div>

          {tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-xs text-slate-500">
              <Headphones className="w-8 h-8 text-slate-700 mb-2" />
              <p>Workspace is clear. No tickets logged.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTicket(t)}
                  className={`w-full p-4 text-left hover:bg-white/[0.01] transition-all block ${
                    activeTicket?.id === t.id ? "bg-white/[0.015] border-l-2 border-violet-500" : ""
                  }`}
                >
                  <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1">
                    <span className="font-bold text-violet-400">ID: {t.id.slice(0, 8)}...</span>
                    <span>{new Date(t.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-205 truncate">{t.subject}</p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    By @{t.user?.profile?.username} · <span className="uppercase text-[9px]">{t.status}</span>
                  </p>
                </button>
              ))}
            </div>
          )}

          {cursor && (
            <button
              onClick={() => handleFetch(false)}
              className="w-full py-2 bg-white/5 text-xs text-slate-400 border-t border-white/5"
              disabled={isPending}
            >
              Older Tickets
            </button>
          )}
        </div>

        {/* Reply window */}
        <div className="lg:col-span-2 glass border border-white/5 rounded-2xl bg-white/[0.01] p-5 flex flex-col justify-between min-h-[450px]">
          {activeTicket ? (
            <div className="flex-1 flex flex-col justify-between">
              {/* Message History */}
              <div className="space-y-4">
                <div className="flex justify-between items-start border-b border-white/5 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-205">{activeTicket.subject}</h4>
                    <p className="text-[10px] text-slate-550">Target Ticket ID: {activeTicket.id}</p>
                  </div>
                  <button
                    onClick={() => handleResolve(activeTicket.id)}
                    className="px-2.5 py-1 rounded bg-emerald-950/15 border border-emerald-900/25 text-emerald-450 hover:bg-emerald-950/30 text-[10px] font-bold"
                  >
                    Mark Resolved
                  </button>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`p-3 rounded-xl text-xs max-w-xl ${
                        m.isAdmin
                          ? "bg-violet-500/10 border border-violet-500/20 ml-auto"
                          : "bg-white/[0.02] border border-white/5 mr-auto"
                      }`}
                    >
                      <div className="flex justify-between items-center text-[9px] text-slate-500 mb-1">
                        <span>{m.isAdmin ? "Staff Agent" : "Member"}</span>
                        <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-slate-205 leading-relaxed font-semibold break-all">{m.content}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Input */}
              <form onSubmit={handleReplySubmit} className="mt-4 pt-3 border-t border-white/5 flex gap-2">
                <input
                  type="text"
                  placeholder="Type reply message..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 px-3 py-2 bg-[#0d0d14] border border-white/5 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-violet-500"
                  required
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-violet-605 border border-violet-500/20 hover:bg-violet-600 text-xs font-bold text-white transition-colors"
                  disabled={isPending}
                >
                  Send
                </button>
              </form>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-xs text-slate-500">
              <MessageSquare className="w-8 h-8 text-slate-700 mb-2" />
              <p>Select an active ticket from the left panel to coordinate assistance chat history.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
