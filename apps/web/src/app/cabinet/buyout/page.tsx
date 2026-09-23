import { CabinetBuyoutPage } from "@/views/cabinet";

export default async function Page({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  return <CabinetBuyoutPage created={!!(await searchParams).created} />;
}
