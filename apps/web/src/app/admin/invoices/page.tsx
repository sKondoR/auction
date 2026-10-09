import { readSearchParams } from "@/shared/lib";
import { AdminInvoicesPage } from "@/views/admin";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  return <AdminInvoicesPage status={(await readSearchParams(searchParams)).status} />;
}
