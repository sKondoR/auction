"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { authClient } from "@/shared/api/auth-client";
import { Button, Field, Input } from "@/shared/ui";

/** Вход и регистрация по номеру телефона и SMS-коду. */
export function PhoneLoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const normalized = () => {
    let d = phone.replace(/\D/g, "");
    if (d.length === 11 && (d[0] === "8" || d[0] === "7")) d = `7${d.slice(1)}`;
    else if (d.length === 10 && d[0] === "9") d = `7${d}`;
    return d.length === 11 ? `+${d}` : null;
  };

  const sendCode = () =>
    start(async () => {
      setError(null);
      const p = normalized();
      if (!p) return setError("Введите российский номер: +7 999 123-45-67");
      const res = await authClient.phoneNumber.sendOtp({ phoneNumber: p });
      if (res.error) return setError(res.error.message ?? "Не удалось отправить код");
      setStep("code");
    });

  const verify = () =>
    start(async () => {
      setError(null);
      const p = normalized()!;
      const res = await authClient.phoneNumber.verify({ phoneNumber: p, code: code.trim() });
      if (res.error) return setError(res.error.message ?? "Неверный код");
      const isNew = res.data?.user?.name === "Новый пользователь";
      router.push(isNew ? `/cabinet/settings?welcome=1` : (next ?? "/"));
      router.refresh();
    });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === "phone") sendCode();
        else verify();
      }}
    >
      {step === "phone" ? (
        <Field label="Номер телефона" hint="Отправим SMS с кодом. Номер не показывается другим пользователям.">
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+7 999 123-45-67"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoFocus
          />
        </Field>
      ) : (
        <Field
          label="Код из SMS"
          hint={
            <>
              Отправили на {normalized()}.{" "}
              <button type="button" className="text-primary underline" onClick={() => setStep("phone")}>
                Изменить номер
              </button>
            </>
          }
        >
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="tabular text-lg tracking-[0.3em]"
            autoFocus
          />
        </Field>
      )}
      {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Подождите…" : step === "phone" ? "Получить код" : "Войти"}
      </Button>
      {step === "code" && (
        <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={sendCode} disabled={pending}>
          Отправить код ещё раз
        </button>
      )}
    </form>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="w-full text-left"
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      Выйти
    </button>
  );
}
