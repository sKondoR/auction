import { readSearchParams } from "@/shared/lib";
import { AdminUsersPage } from "@/views/admin";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return <AdminUsersPage q={(await readSearchParams(searchParams)).q} />;
}
