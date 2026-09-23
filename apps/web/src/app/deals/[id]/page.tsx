import { notFound } from "next/navigation";
import { DealPage } from "@/views/deal";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <DealPage id={id} />;
}
