// This file intentionally has NO "use server" directive.
// It's a plain utility module, safe to import from both server and client code,
// and its exports don't need to be async (unlike files marked "use server").

export function extractMentionUsernames(text: string): string[] {
  const matches = text.match(/@([\w.]+)/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}
