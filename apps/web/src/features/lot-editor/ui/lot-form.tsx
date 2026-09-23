"use client";

import {
  DELIVERY_METHOD_LABELS,
  DELIVERY_METHODS,
  ENGLISH_MAX_DAYS,
  FIXED_MAX_DAYS,
  type LotFormat,
  MAX_PHOTOS,
} from "@auction/domain";
import { Gavel, Tag } from "lucide-react";
import { useActionState, useState } from "react";
import { cn, kopecksToInput } from "@/shared/lib";
import { Card, CardSection, Checkbox, Field, Form, FormMessage, Input, Select, SubmitButton, Textarea } from "@/shared/ui";
import { createLotAction, updateLotAction } from "../api/actions";
import { PhotoUploader, type UploadedPhoto } from "@/shared/ui";

export interface AttributeDef {
  key: string;
  name: string;
  type: "text" | "number" | "select";
  options: string[] | null;
  unit: string | null;
}

export interface LotFormValues {
  id?: number;
  format: LotFormat;
  title: string;
  description: string;
  categoryId: number | null;
  attributes: Record<string, string | number>;
  city: string;
  deliveryMethods: string[];
  deliveryCost: string;
  durationDays: number;
  price: number | null;
  quantity: number;
  blitzPrice: number | null;
  allowOffers: boolean;
  autoRelist: boolean;
  photos: UploadedPhoto[];
}

export function LotForm({
  mode,
  initial,
  categories,
  attributeDefs,
  hasBids = false,
}: {
  mode: "create" | "edit";
  initial: LotFormValues;
  categories: { id: number; label: string }[];
  attributeDefs: Record<number, AttributeDef[]>;
  hasBids?: boolean;
}) {
  const [state, action] = useActionState(mode === "create" ? createLotAction : updateLotAction, null);
  const [format, setFormat] = useState<LotFormat>(initial.format);
  const [categoryId, setCategoryId] = useState<number | null>(initial.categoryId);
  const attrs = categoryId ? (attributeDefs[categoryId] ?? []) : [];
  const locked = hasBids;
  const maxDays = format === "english" ? ENGLISH_MAX_DAYS : FIXED_MAX_DAYS;

  return (
    <Form action={action} state={state} className="flex flex-col gap-5">
      {initial.id && <input type="hidden" name="lotId" value={initial.id} />}
      <input type="hidden" name="format" value={format} />

      {locked && (
        <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
          По лоту уже есть ставки или покупки: цену, срок и описание менять нельзя. Описание можно дополнить на странице лота,
          блиц-цену — только снизить.
        </p>
      )}

      {mode === "create" && (
        <Card>
          <CardSection className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["english", "Аукцион", "Цена растёт со ставками. От 1 ₽, 1–21 день, автоставки и блиц-цена.", Gavel],
                ["fixed", "Фиксированная цена", "Продажа по вашей цене, до 60 дней. Можно несколько штук и «Предложить свою цену».", Tag],
              ] as const
            ).map(([f, title, desc, Icon]) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={cn(
                  "flex gap-3 rounded-md border p-4 text-left transition-colors",
                  format === f ? "border-primary bg-primary/5" : "hover:bg-muted",
                )}
              >
                <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", format === f ? "text-primary" : "text-muted-foreground")} />
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="text-sm text-muted-foreground">{desc}</span>
                </span>
              </button>
            ))}
          </CardSection>
        </Card>
      )}

      <Card>
        <CardSection className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Предмет</h2>
          <Field label="Название">
            <Input name="title" defaultValue={initial.title} maxLength={150} required disabled={locked} placeholder="Например: 1 рубль 1924 года, серебро" />
          </Field>
          <Field label="Категория">
            <Select
              name="categoryId"
              value={categoryId ?? ""}
              onChange={(e) => setCategoryId(Number(e.target.value) || null)}
              required
              disabled={locked}
            >
              <option value="">— выберите —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
            {locked && <input type="hidden" name="categoryId" value={categoryId ?? ""} />}
          </Field>
          {attrs.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {attrs.map((a) => (
                <Field key={a.key} label={`${a.name}${a.unit ? `, ${a.unit}` : ""}`}>
                  {a.type === "select" ? (
                    <Select name={`attr.${a.key}`} defaultValue={String(initial.attributes[a.key] ?? "")} disabled={locked}>
                      <option value="">—</option>
                      {a.options?.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      name={`attr.${a.key}`}
                      defaultValue={String(initial.attributes[a.key] ?? "")}
                      inputMode={a.type === "number" ? "numeric" : undefined}
                      disabled={locked}
                    />
                  )}
                </Field>
              ))}
            </div>
          )}
          <Field label="Описание" hint="Телефоны, email и ссылки автоматически скрываются.">
            <Textarea name="description" defaultValue={initial.description} rows={8} maxLength={20000} disabled={locked} />
          </Field>
          <Field label="Фото">
            <PhotoUploader initial={initial.photos} max={MAX_PHOTOS} />
          </Field>
        </CardSection>
      </Card>

      <Card>
        <CardSection className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Цена и срок</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={format === "english" ? "Стартовая цена, ₽" : "Цена, ₽"} hint={format === "english" ? "От 1 ₽" : undefined}>
              <Input name="price" inputMode="decimal" defaultValue={kopecksToInput(initial.price)} required disabled={locked} className="tabular" />
            </Field>
            <Field label="Срок, дней" hint={format === "english" ? `1–${ENGLISH_MAX_DAYS}` : `до ${FIXED_MAX_DAYS}`}>
              <Input
                type="number"
                name="durationDays"
                min={1}
                max={maxDays}
                defaultValue={Math.min(initial.durationDays, maxDays)}
                key={format}
                required
                disabled={locked}
              />
            </Field>
            {format === "fixed" ? (
              <Field label="Количество, шт.">
                <Input type="number" name="quantity" min={1} defaultValue={initial.quantity} disabled={locked} />
              </Field>
            ) : (
              <Field label="Блиц-цена, ₽" hint="Необязательно. Покупка сразу, пока ставки ниже.">
                <Input name="blitzPrice" inputMode="decimal" defaultValue={kopecksToInput(initial.blitzPrice)} className="tabular" />
              </Field>
            )}
          </div>
          {locked && (
            <>
              <input type="hidden" name="price" value={kopecksToInput(initial.price)} />
              <input type="hidden" name="durationDays" value={initial.durationDays} />
              <input type="hidden" name="quantity" value={initial.quantity} />
              <input type="hidden" name="title" value={initial.title} />
              <input type="hidden" name="description" value={initial.description} />
              {Object.entries(initial.attributes).map(([k, v]) => (
                <input key={k} type="hidden" name={`attr.${k}`} value={String(v)} />
              ))}
            </>
          )}
          {format === "fixed" && <Checkbox name="allowOffers" defaultChecked={initial.allowOffers} label="Принимать предложения цены («Предложить свою цену»)" />}
          <Checkbox
            name="autoRelist"
            defaultChecked={initial.autoRelist}
            label="Перевыставить автоматически до 3 раз, если лот не продастся"
          />
        </CardSection>
      </Card>

      <Card>
        <CardSection className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Доставка</h2>
          <Field label="Город">
            <Input name="city" defaultValue={initial.city} required disabled={locked} />
            {locked && <input type="hidden" name="city" value={initial.city} />}
          </Field>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {DELIVERY_METHODS.map((m) => (
              <Checkbox key={m} name="delivery" value={m} defaultChecked={initial.deliveryMethods.includes(m)} label={DELIVERY_METHOD_LABELS[m]} />
            ))}
          </div>
          <Field label="Стоимость доставки" hint="Текстом, например: «Почта — 350 ₽, СДЭК — по тарифу»">
            <Input name="deliveryCost" defaultValue={initial.deliveryCost} maxLength={300} />
          </Field>
        </CardSection>
      </Card>

      <div className="flex flex-col gap-3">
        <FormMessage state={state} />
        <SubmitButton size="lg" className="self-start" pendingText="Сохраняем…">
          {mode === "create" ? "Выставить лот" : "Сохранить изменения"}
        </SubmitButton>
        {mode === "create" && (
          <p className="text-xs text-muted-foreground">
            Размещение бесплатное. С продажи площадка берёт комиссию 1% — счёт выставляется раз в месяц.
          </p>
        )}
      </div>
    </Form>
  );
}
