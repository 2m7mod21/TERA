import { requireAdminPage } from "@/lib/adminAuth";
import VerificationClient from "@/components/admin/VerificationClient";
import { prisma } from "@/lib/db";

export const metadata = { title: "Verification — TERA Admin" };

export default async function VerificationPage() {
  await requireAdminPage("verification");
  // Users who requested verification (using verifiedBadge=false as "pending" proxy)
  // In a full system this would be a VerificationRequest model — we use user status for now
  const verified = await prisma.user.findMany({
    where: { verifiedBadge: true },
    include: { profile: true },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return <VerificationClient verifiedUsers={verified} />;
}
