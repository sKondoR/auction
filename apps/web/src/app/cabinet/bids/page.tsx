import { readSearchParams } from "@/shared/lib";
import { CabinetBidsPage } from "@/views/cabinet";

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return <CabinetBidsPage tab={(await readSearchParams(searchParams)).tab} />;
}
