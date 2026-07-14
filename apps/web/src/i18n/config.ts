// Central locale registry – adding a new language requires only:
// 1. Adding its code to `locales` below
// 2. Creating messages/<code>/ with the same JSON structure as messages/en/
export const locales = ["en", "ar", "fr"] as const;

export type Locale = (typeof locales)[number];

/** Default locale used when no locale prefix is detected */
export const defaultLocale: Locale = "en";

/** Locales that use right-to-left text direction */
export const rtlLocales: Locale[] = ["ar"];

/** Human-readable locale display names (in the target language itself) */
export const localeNames: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
  fr: "Français",
};

/** Flag emojis for the language switcher */
export const localeFlags: Record<Locale, string> = {
  en: "🇺🇸",
  ar: "🇸🇦",
  fr: "🇫🇷",
};

/** Returns true if the locale uses RTL layout */
export function isRTL(locale: string): boolean {
  return rtlLocales.includes(locale as Locale);
}

/** Locales to expose for hreflang alternates (includes x-default) */
export const hreflangLocales = [...locales, "x-default"] as const;
