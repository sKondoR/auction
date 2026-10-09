import { readSearchParams } from "@/shared/lib";
import { CabinetLotsPage } from "@/views/cabinet";

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return <CabinetLotsPage tab={(await readSearchParams(searchParams)).tab} />;
}
