import { readSearchParams } from "@/shared/lib";
import { CabinetDealsPage } from "@/views/cabinet";

export default async function Page({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  return <CabinetDealsPage role={(await readSearchParams(searchParams)).role} />;
}
