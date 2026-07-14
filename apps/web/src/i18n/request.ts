import { getRequestConfig } from "next-intl/server";
import { locales, defaultLocale } from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  // Validate locale from routing
  let locale = await requestLocale;
  if (!locale || !locales.includes(locale as any)) {
    locale = defaultLocale;
  }

  // Load all translation namespaces for this locale
  const namespaces = [
    "common",
    "auth",
    "feed",
    "profile",
    "notifications",
    "messages",
    "explore",
    "settings",
    "admin",
    "errors",
  ];

  const messages: Record<string, any> = {};

  for (const ns of namespaces) {
    try {
      const mod = await import(`../../messages/${locale}/${ns}.json`);
      messages[ns] = mod.default;
    } catch {
      // Fallback to English if translation file is missing
      try {
        const fallbackMod = await import(`../../messages/en/${ns}.json`);
        messages[ns] = fallbackMod.default;
      } catch {
        messages[ns] = {};
      }
    }
  }

  return {
    locale,
    messages,
    // ICU message format used for pluralization (Arabic has 6 plural forms)
    formats: {
      dateTime: {
        short: { day: "numeric", month: "short", year: "numeric" },
        relative: { numeric: "auto" },
      },
      number: {
        currency: { style: "currency", currency: "USD" },
        percent: { style: "percent" },
      },
    },
  };
});
