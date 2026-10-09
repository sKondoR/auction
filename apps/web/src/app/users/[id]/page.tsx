import { getDb, user } from "@auction/db";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { demoStaticParams } from "@/shared/api";
import { SellerPage } from "@/views/seller";

type Params = Promise<{ id: string }>;

export const generateStaticParams = () => demoStaticParams(() => getDb().select({ id: user.id }).from(user));

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [u] = await getDb().select({ name: user.name }).from(user).where(eq(user.id, (await params).id));
  return u ? { title: `Продавец ${u.name}` } : {};
}

export default async function Page({ params }: { params: Params }) {
  return <SellerPage id={(await params).id} />;
}
