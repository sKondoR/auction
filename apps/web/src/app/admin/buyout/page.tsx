import { AdminBuyoutPage } from "@/views/admin";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  return <AdminBuyoutPage status={(await searchParams).status} />;
}
