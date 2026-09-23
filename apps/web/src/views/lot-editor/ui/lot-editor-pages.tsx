import { lotPhotos, lots } from "@auction/db";
import { DAY_MS, isOpen } from "@auction/domain";
import { publicUrl } from "@auction/services";
import { asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getAllAttributeDefs, getCategoryOptions } from "@/entities/category/server";
import { type AttributeDef, LotForm } from "@/features/lot-editor";
import { getDb, requireViewer } from "@/shared/api";
import { PageHeader } from "@/shared/ui";

export async function LotCreatePage() {
  const viewer = await requireViewer("/lots/new");
  const [categories, attrs] = await Promise.all([getCategoryOptions(), getAllAttributeDefs()]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Новый лот" description="Лот публикуется сразу, без премодерации. Правила площадки запрещают передачу контактов." />
      {viewer.listingBlocked && (
        <p className="mb-4 rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
          Выставление новых лотов заблокировано из-за просроченного счёта. Оплатите счёт в разделе «Счета».
        </p>
      )}
      <LotForm
        mode="create"
        categories={categories}
        attributeDefs={attrs as Record<number, AttributeDef[]>}
        initial={{
          format: "english",
          title: "",
          description: "",
          categoryId: null,
          attributes: {},
          city: viewer.city ?? "",
          deliveryMethods: ["post"],
          deliveryCost: "",
          durationDays: 7,
          price: null,
          quantity: 1,
          blitzPrice: null,
          allowOffers: false,
          autoRelist: false,
          photos: [],
        }}
      />
    </div>
  );
}

export async function LotEditPage({ id }: { id: number }) {
  const viewer = await requireViewer(`/lots/${id}/edit`);
  const db = getDb();
  const [lot] = await db.select().from(lots).where(eq(lots.id, id));
  if (!lot) notFound();
  if (lot.sellerId !== viewer.id) notFound();
  if (!isOpen(lot, new Date())) redirect(`/lots/${id}`);
  const [categories, attrs, photos] = await Promise.all([
    getCategoryOptions(),
    getAllAttributeDefs(),
    db.select().from(lotPhotos).where(eq(lotPhotos.lotId, id)).orderBy(asc(lotPhotos.position)),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Редактирование лота" description={lot.title} />
      <LotForm
        mode="edit"
        hasBids={lot.bidCount > 0 || lot.quantitySold > 0}
        categories={categories}
        attributeDefs={attrs as Record<number, AttributeDef[]>}
        initial={{
          id: lot.id,
          format: lot.format,
          title: lot.title,
          description: lot.description,
          categoryId: lot.categoryId,
          attributes: lot.attributes,
          city: lot.city,
          deliveryMethods: lot.deliveryMethods,
          deliveryCost: lot.deliveryCost,
          durationDays: Math.round((lot.originalEndsAt.getTime() - lot.startsAt.getTime()) / DAY_MS),
          price: lot.startPrice,
          quantity: lot.quantity,
          blitzPrice: lot.blitzPrice,
          allowOffers: lot.allowOffers,
          autoRelist: lot.autoRelist,
          photos: photos.map((p) => ({ id: p.id, key: p.key, thumbKey: p.thumbKey, thumbUrl: publicUrl(p.thumbKey) })),
        }}
      />
    </div>
  );
}
