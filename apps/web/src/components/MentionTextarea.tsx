"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { searchUsersForMention } from "@/server/actions/mentions";
import { CheckCircle, AtSign } from "lucide-react";

interface MentionUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  isFollowing: boolean;
}

interface MentionTextareaProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  maxLength?: number;
  id?: string;
  autoFocus?: boolean;
  dropdownPosition?: "top" | "bottom";
}

export default function MentionTextarea({
  value,
  onChange,
  placeholder,
  className = "",
  rows = 4,
  maxLength,
  id,
  autoFocus,
  dropdownPosition = "bottom",
}: MentionTextareaProps) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect @mention trigger
  const detectMention = useCallback((text: string) => {
    const textarea = textRef.current;
    if (!textarea) return;
    const cursor = textarea.selectionStart ?? 0;
    const before = text.slice(0, cursor);
    const match = before.match(/@([\w.]*)$/);
    if (match) {
      setMentionQuery(match[1] ?? "");
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  }, []);

  // Debounced user search
  useEffect(() => {
    if (!showDropdown) return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setLoading(true);
      const res = await searchUsersForMention(mentionQuery);
      setUsers(res.users);
      setActiveIdx(0);
      setLoading(false);
    }, 200);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [mentionQuery, showDropdown]);

  // Insert @username into textarea
  const insertMention = useCallback(
    (username: string) => {
      const textarea = textRef.current;
      if (!textarea) return;
      const cursor = textarea.selectionStart ?? 0;
      const before = value.slice(0, cursor);
      const after = value.slice(cursor);
      const newBefore = before.replace(/@[\w.]*$/, `@${username} `);
      const newValue = newBefore + after;
      onChange(newValue);
      setShowDropdown(false);
      setTimeout(() => {
        textarea.focus();
        const pos = newBefore.length;
        textarea.setSelectionRange(pos, pos);
      }, 10);
    },
    [value, onChange]
  );

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showDropdown || users.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % users.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + users.length) % users.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      const selected = users[activeIdx];
      if (selected) {
        e.preventDefault();
        insertMention(selected.username);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);
    detectMention(val);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !textRef.current?.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative">
      <textarea
        ref={textRef}
        id={id}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        autoFocus={autoFocus}
        className={className}
        aria-label={placeholder}
        aria-autocomplete="list"
        aria-expanded={showDropdown}
      />

      {/* Mention Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          role="listbox"
          className={`absolute z-[100] left-0 w-72 bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-2xl overflow-hidden ${
            dropdownPosition === "top" ? "bottom-full mb-2" : "top-full mt-1"
          }`}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
            <AtSign className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              {mentionQuery ? `Mention "@${mentionQuery}"` : "Mention someone"}
            </span>
          </div>

          {loading && (
            <div className="px-4 py-4 text-center">
              <div className="inline-flex gap-1 items-center">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {!loading && users.length === 0 && (
            <div className="px-4 py-4 text-center text-xs text-zinc-500">
              {mentionQuery ? `No users found for "@${mentionQuery}"` : "Start typing to search..."}
            </div>
          )}

          {!loading && users.length > 0 && (
            <div className="py-1 max-h-52 overflow-y-auto">
              {users.map((u, idx) => (
                <button
                  key={u.id}
                  role="option"
                  aria-selected={idx === activeIdx}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(u.username);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all ${
                    idx === activeIdx
                      ? "bg-violet-600/20 text-white"
                      : "text-zinc-200 hover:bg-zinc-800/60"
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
                      {u.avatarUrl ? (
                        <img
                          src={u.avatarUrl}
                          alt={u.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-bold text-sm">
                          {u.displayName[0]?.toUpperCase() ?? "?"}
                        </span>
                      )}
                    </div>
                    {u.isFollowing && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-zinc-900 flex items-center justify-center">
                        <span className="text-[7px] text-white font-black">✓</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold truncate leading-tight">
                        {u.displayName}
                      </span>
                      {u.isVerified && (
                        <CheckCircle className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                      )}
                    </div>
                    <span className="text-xs text-zinc-400 truncate block">
                      @{u.username}
                    </span>
                  </div>

                  {/* Following badge */}
                  {u.isFollowing && (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                      Following
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Tip */}
          <div className="px-3 py-1.5 border-t border-zinc-800/60">
            <p className="text-[10px] text-zinc-600">
              ↑↓ navigate · Enter/Tab to select · Esc to close
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
