import { LoginPage } from "@/views/auth";

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <LoginPage next={(await searchParams).next} />;
}
