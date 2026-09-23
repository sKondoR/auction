import { AdminComplaintsPage } from "@/views/admin";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  return <AdminComplaintsPage status={(await searchParams).status} />;
}
