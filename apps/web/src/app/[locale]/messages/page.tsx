import { auth } from "@/server/auth/config";
import { getInbox } from "@/server/actions/messaging";
import { redirect } from "next/navigation";
import MessagesClient from "@/components/MessagesClient";

export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  const conversations = await getInbox();
  return (
    <MessagesClient
      conversations={conversations as any[]}
      currentUserId={session.user.id}
      currentUser={session.user as any}
    />
  );
}
