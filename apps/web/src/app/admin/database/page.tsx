import { getDatabaseInfo } from "@/server/actions/admin/system";
import { requireAdminPage } from "@/lib/adminAuth";
import { getAdminContext } from "@/lib/adminAuth";
import { redirect } from "next/navigation";
import DatabaseClient from "@/components/admin/DatabaseClient";

export const metadata = { title: "Database Management — TERA Admin" };

export default async function DatabasePage() {
  const ctx = await getAdminContext();
  // Extra guard — Owner only
  if (!ctx || ctx.role !== "OWNER") redirect("/admin");

  const dbInfo = await getDatabaseInfo();
  return <DatabaseClient tables={dbInfo.tables} />;
}
