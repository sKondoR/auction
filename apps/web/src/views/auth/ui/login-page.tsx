import { redirect } from "next/navigation";
import { PhoneLoginForm } from "@/features/auth-by-phone";
import { getViewer } from "@/shared/api";
import { Card, CardSection } from "@/shared/ui";

export async function LoginPage({ next }: { next?: string }) {
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (await getViewer()) redirect(safeNext);
  return (
    <div className="mx-auto mt-6 max-w-md">
      <Card>
        <CardSection className="p-6 sm:p-8">
          <h1 className="text-2xl font-semibold">Вход и регистрация</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">По номеру телефона — без пароля. Новый аккаунт создаётся автоматически.</p>
          <PhoneLoginForm next={safeNext} />
          {process.env.NODE_ENV !== "production" && (
            <p className="mt-6 rounded-md bg-info-soft px-3 py-2 text-xs text-info">
              Локальная разработка: код из SMS печатается в консоли <code>pnpm dev</code>. Тестовые номера: администратор +7 999 000-00-01,
              модератор …02, оценщик …03, продавец +7 999 111-11-11, покупатель +7 999 222-22-22.
            </p>
          )}
        </CardSection>
      </Card>
    </div>
  );
}
