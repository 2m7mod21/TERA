import { getAdminContext } from "@/lib/adminAuth";
import { redirect } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/");

  return (
    <AdminLayout role={ctx.role} permissions={ctx.permissions}>
      {children}
    </AdminLayout>
  );
}
