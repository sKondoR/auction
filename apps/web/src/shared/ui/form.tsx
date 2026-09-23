"use client";

import { type ComponentProps, createContext, type ReactNode, useContext, useEffect, useRef, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "../lib";
import { Button } from "./button";

const control =
  "w-full rounded-md border bg-surface px-3 text-sm placeholder:text-muted-foreground/70 disabled:opacity-60 focus:border-accent focus:outline-none";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-2", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "h-10", className)} {...props} />;
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
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("inline-flex items-center gap-2 text-sm cursor-pointer", className)}>
      <input type="checkbox" className="h-4 w-4 accent-[var(--color-primary)]" {...props} />
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
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? (pendingText ?? "Подождите…") : children}
    </Button>
  );
}

export function FormMessage({ state }: { state: { ok: boolean; error?: string; message?: string } | null | undefined }) {
  if (!state) return null;
  if (!state.ok && state.error) {
    return <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{state.error}</p>;
  }
  if (state.ok && state.message) {
    return <p className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">{state.message}</p>;
  }
  return null;
}
