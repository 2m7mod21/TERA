import { requireAdminPage } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import MessagesAdminClient from "@/components/admin/MessagesAdminClient";

export const metadata = { title: "Messages Management — TERA Admin" };

export default async function MessagesAdminPage() {
  await requireAdminPage("messages");

  const [totalMessages, totalConversations, reportedCount] = await Promise.all([
    prisma.message.count(),
    prisma.conversation.count(),
    prisma.report.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <MessagesAdminClient
      stats={{ totalMessages, totalConversations, reportedCount }}
    />
  );
}
