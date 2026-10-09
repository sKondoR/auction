import { deals } from "@auction/db";
import { notFound } from "next/navigation";
import { demoStaticParams, getDb } from "@/shared/api";
import { DealPage } from "@/views/deal";

export const generateStaticParams = () => demoStaticParams(() => getDb().select({ id: deals.id }).from(deals));

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <DealPage id={id} />;
}
