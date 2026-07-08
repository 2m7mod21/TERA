import { getAdmins, getAdminRoles } from "@/server/actions/admin/security";
import { requireAdminPage } from "@/lib/adminAuth";
import AdminManagementClient from "@/components/admin/AdminManagementClient";

export const metadata = { title: "Admin Management — TERA Admin" };

export default async function AdminManagementPage() {
  const ctx = await requireAdminPage("adminManagement");
  const [admins, roles] = await Promise.all([getAdmins(), getAdminRoles()]);
  return <AdminManagementClient admins={admins} roles={roles} currentRole={ctx.role} />;
}
