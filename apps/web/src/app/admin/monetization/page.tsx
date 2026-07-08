import { getRevenueStats, getTransactions } from "@/server/actions/admin/monetization";
import { requireAdminPage } from "@/lib/adminAuth";
import MonetizationClient from "@/components/admin/MonetizationClient";

export const metadata = { title: "Monetization — TERA Admin" };

export default async function MonetizationPage() {
  await requireAdminPage("monetization");
  const [revenue, { tips, nextCursor }] = await Promise.all([
    getRevenueStats(),
    getTransactions(),
  ]);
  return <MonetizationClient revenue={revenue} initialTips={tips} initialCursor={nextCursor} />;
}
