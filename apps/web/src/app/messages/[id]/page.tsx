import { auth } from "@/server/auth/config";
import { getInbox } from "@/server/actions/messaging";
import { redirect } from "next/navigation";
import MessagesClient from "@/components/MessagesClient";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const conversations = await getInbox();

  return (
    <MessagesClient
      conversations={conversations as any[]}
      currentUserId={session.user.id}
      currentUser={session.user as any}
      initialConversationId={id}
    />
  );
}
