import { getAdCampaigns } from "@/server/actions/admin/monetization";
import { requireAdminPage } from "@/lib/adminAuth";
import AdsClient from "@/components/admin/AdsClient";

export const metadata = { title: "Ads Manager — TERA Admin" };

export default async function AdsPage() {
  await requireAdminPage("ads");
  const { campaigns, nextCursor } = await getAdCampaigns("PENDING");
  return <AdsClient initialCampaigns={campaigns} initialCursor={nextCursor} />;
}
