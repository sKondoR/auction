import { getDb, lots } from "@auction/db";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { demoStaticParams } from "@/shared/api";
import { readSearchParams } from "@/shared/lib";
import { LotPage } from "@/views/lot";

type Params = Promise<{ id: string }>;

export const generateStaticParams = () => demoStaticParams(() => getDb().select({ id: lots.id }).from(lots));

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return {};
  const [lot] = await getDb().select({ title: lots.title }).from(lots).where(eq(lots.id, id));
  return lot ? { title: lot.title } : {};
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ created?: string; relisted?: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const sp = await readSearchParams(searchParams);
  const flash = sp.created ? "Лот выставлен на торги." : sp.relisted ? "Лот перевыставлен." : undefined;
  return <LotPage id={id} flash={flash} />;
}
