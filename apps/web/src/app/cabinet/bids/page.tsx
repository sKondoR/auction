import { CabinetBidsPage } from "@/views/cabinet";

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return <CabinetBidsPage tab={(await searchParams).tab} />;
}
