import { conversations } from "@auction/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { demoStaticParams, getDb } from "@/shared/api";
import { AdminSupportThreadPage } from "@/views/admin";

export const generateStaticParams = () =>
  demoStaticParams(() => getDb().select({ id: conversations.id }).from(conversations).where(eq(conversations.kind, "support")));

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <AdminSupportThreadPage id={id} />;
}
