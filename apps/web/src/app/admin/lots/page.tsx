import { readSearchParams } from "@/shared/lib";
import { AdminLotsPage } from "@/views/admin";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return <AdminLotsPage q={(await readSearchParams(searchParams)).q} />;
}
