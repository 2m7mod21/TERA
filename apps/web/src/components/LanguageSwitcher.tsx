"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, localeNames, localeFlags, type Locale } from "@/i18n/config";
import { Globe } from "lucide-react";

export default function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const handleLanguageChange = (nextLocale: Locale) => {
    // Persist choice via cookie (read by next-intl middleware)
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    // Persist choice to localStorage for helper APIs
    localStorage.setItem("NEXT_LOCALE", nextLocale);
    
    // Redirect path to new locale root/path
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <div className="relative inline-block">
      <select
        value={locale}
        onChange={(e) => handleLanguageChange(e.target.value as Locale)}
        className="appearance-none bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold py-1.5 ps-3 pe-8 rounded-full border border-zinc-700/60 focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer transition-all"
      >
        {locales.map((loc) => (
          <option key={loc} value={loc} className="bg-zinc-900 text-zinc-100">
            {localeFlags[loc]}  {localeNames[loc]}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-2.5 text-zinc-400">
        <Globe className="w-3.5 h-3.5" />
      </div>
    </div>
  );
}
