import { ButtonLink, EmptyState } from "@/shared/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-10">
      <EmptyState title="Страница не найдена">
        <ButtonLink href="/" variant="outline" className="mt-4">
          На главную
        </ButtonLink>
      </EmptyState>
    </div>
  );
}
