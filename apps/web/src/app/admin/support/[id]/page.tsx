import { notFound } from "next/navigation";
import { AdminSupportThreadPage } from "@/views/admin";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <AdminSupportThreadPage id={id} />;
}
