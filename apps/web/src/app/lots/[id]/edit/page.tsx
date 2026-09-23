import { notFound } from "next/navigation";
import { LotEditPage } from "@/views/lot-editor";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <LotEditPage id={id} />;
}
