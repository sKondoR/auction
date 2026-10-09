import { conversations } from "@auction/db";
import { notFound } from "next/navigation";
import { demoStaticParams, getDb } from "@/shared/api";
import { ConversationPage } from "@/views/messages";

export const generateStaticParams = () => demoStaticParams(() => getDb().select({ id: conversations.id }).from(conversations));

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <ConversationPage id={id} />;
}
