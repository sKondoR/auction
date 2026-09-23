"use client";

import { type ComponentProps, type ReactNode, useActionState } from "react";
import type { ActionState } from "../api/types";
import { cn } from "../lib";
import { Form, FormMessage, SubmitButton } from "./form";

type ServerAction = (state: ActionState, form: FormData) => Promise<ActionState>;

/**
 * Универсальная форма серверного действия: поля передаются детьми, результат
 * показывается под кнопкой. Действие можно передать из серверного компонента.
 */
export function ActionForm({
  action,
  children,
  submit,
  submitVariant,
  submitSize = "sm",
  confirmText,
  className,
  inline,
}: {
  action: ServerAction;
  children?: ReactNode;
  submit: ReactNode;
  submitVariant?: ComponentProps<typeof SubmitButton>["variant"];
  submitSize?: ComponentProps<typeof SubmitButton>["size"];
  confirmText?: string;
  className?: string;
  inline?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <Form
      action={formAction} state={state}
      onSubmit={(e) => {
        if (confirmText && !confirm(confirmText)) e.preventDefault();
      }}
      className={cn(inline ? "flex flex-wrap items-end gap-2" : "flex flex-col gap-3", className)}
    >
      {children}
      <SubmitButton variant={submitVariant} size={submitSize} className={inline ? undefined : "self-start"}>
        {submit}
      </SubmitButton>
      <FormMessage state={state} />
    </Form>
  );
}
