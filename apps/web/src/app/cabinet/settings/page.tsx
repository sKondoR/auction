import { readSearchParams } from "@/shared/lib";
import { CabinetSettingsPage } from "@/views/cabinet";

export default async function Page({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  return <CabinetSettingsPage welcome={!!(await readSearchParams(searchParams)).welcome} />;
}
