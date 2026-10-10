"use client";

import { AlertCircle, Check } from "lucide-react";
import { type ComponentProps, createContext, type ReactNode, useContext, useEffect, useRef, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "../lib";
import { Button } from "./button";

/** Поле по DESIGN.md: белое, рамка line, 8px, 48px; фокус — зелёная рамка и кольцо шалфейной дымки. */
const control =
  "w-full rounded-md border border-border bg-surface px-4 text-base text-foreground transition-[border-color,box-shadow] duration-200 placeholder:text-faint hover:border-border-strong focus:border-primary focus:shadow-[0_0_0_3px_var(--color-sage-mist)] focus:outline-none disabled:opacity-60 aria-invalid:border-wax";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-28 py-3", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "h-12 cursor-pointer pr-10", className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium", className)} {...props} />;
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-base", className)}>
      <input type="checkbox" className="size-5 accent-primary" {...props} />
      {label}
    </label>
  );
}

const FormPendingContext = createContext(false);

/**
 * Форма серверного действия, которая не теряет введённое при ошибке.
 * React 19 сбрасывает `<form action>` после любого завершения действия, поэтому
 * отправка идёт через onSubmit, а поля очищаются только при `state.ok`.
 */
export function Form({
  action,
  state,
  onSubmit,
  ...props
}: Omit<ComponentProps<"form">, "action"> & {
  action: (form: FormData) => void;
  state?: { ok: boolean } | null;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <FormPendingContext value={pending}>
      <form
        ref={ref}
        {...props}
        onSubmit={(e) => {
          onSubmit?.(e);
          if (e.defaultPrevented) return;
          e.preventDefault();
          const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
          startTransition(() => action(data));
        }}
      />
    </FormPendingContext>
  );
}

/** Кнопка отправки с состоянием ожидания формы. */
export function SubmitButton({ children, pendingText, ...props }: ComponentProps<typeof Button> & { pendingText?: string }) {
  const formPending = useContext(FormPendingContext);
  const pending = useFormStatus().pending || formPending;
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending || undefined} {...props}>
      {pending ? (pendingText ?? "Подождите…") : children}
    </Button>
  );
}

export function FormMessage({ state }: { state: { ok: boolean; error?: string; message?: string } | null | undefined }) {
  if (!state) return null;
  if (!state.ok && state.error) {
    return (
      <p className="flex items-start gap-2 text-[0.9375rem] text-wax" role="alert">
        <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p className="flex items-start gap-2 text-[0.9375rem] text-success" role="status">
        <Check className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
        {state.message}
      </p>
    );
  }
  return null;
}
