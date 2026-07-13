"use client";

export interface SavedAccount {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  username: string;
  switchToken: string;
}

const STORAGE_KEY = "nexus_accounts";

export function getSavedAccounts(): SavedAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveAccount(account: SavedAccount) {
  if (typeof window === "undefined") return;
  try {
    const accounts = getSavedAccounts();
    const filtered = accounts.filter((a) => a.id !== account.id);
    filtered.push(account);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Error saving account", error);
  }
}

export function removeSavedAccount(accountId: string) {
  if (typeof window === "undefined") return;
  try {
    const accounts = getSavedAccounts();
    const filtered = accounts.filter((a) => a.id !== accountId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Error removing account", error);
  }
}
