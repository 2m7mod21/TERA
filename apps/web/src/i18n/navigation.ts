import { createNavigation } from "next-intl/navigation";
import { locales } from "./config";

// Creates localized wrap utilities for client and server routing
export const { Link, redirect, usePathname, useRouter } = createNavigation({
  locales,
});
