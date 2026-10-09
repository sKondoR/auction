import { lots } from "@auction/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { demoStaticParams, getDb, getViewer } from "@/shared/api";
import { LotEditPage } from "@/views/lot-editor";

// Редактировать можно только свои лоты.
export const generateStaticParams = () =>
  demoStaticParams(async () => {
    const viewer = await getViewer();
    return viewer ? getDb().select({ id: lots.id }).from(lots).where(eq(lots.sellerId, viewer.id)) : [];
  });

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <LotEditPage id={id} />;
}
