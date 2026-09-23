import { AdminLotsPage } from "@/views/admin";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return <AdminLotsPage q={(await searchParams).q} />;
}
