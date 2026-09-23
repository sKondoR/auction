import { AdminInvoicesPage } from "@/views/admin";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  return <AdminInvoicesPage status={(await searchParams).status} />;
}
