import { SearchPage } from "@/views/search";

export const metadata = { title: "Поиск лотов" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <SearchPage searchParams={await searchParams} />;
}
