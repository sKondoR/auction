import { AdminUsersPage } from "@/views/admin";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return <AdminUsersPage q={(await searchParams).q} />;
}
