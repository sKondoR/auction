import { readSearchParams } from "@/shared/lib";
import { AdminComplaintsPage } from "@/views/admin";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  return <AdminComplaintsPage status={(await readSearchParams(searchParams)).status} />;
}
