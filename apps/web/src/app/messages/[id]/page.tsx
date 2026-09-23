import { notFound } from "next/navigation";
import { ConversationPage } from "@/views/messages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <ConversationPage id={id} />;
}
