import { getUsers } from "@/server/actions/admin/users";
import { requireAdminPage } from "@/lib/adminAuth";
import UsersClient from "@/components/admin/UsersClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "User Management — TERA Admin" };

export default async function UsersPage() {
  await requireAdminPage("users");
  const { users, nextCursor } = await getUsers();
  return <UsersClient initialUsers={users} initialCursor={nextCursor} />;
}
