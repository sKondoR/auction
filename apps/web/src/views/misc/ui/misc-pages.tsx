import { BuyoutRequestForm } from "@/features/account";
import { requireViewer } from "@/shared/api";
import { Card, CardSection, PageHeader } from "@/shared/ui";

export async function BuyoutNewPage() {
  await requireViewer("/buyout/new");
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Продать площадке"
        description="Площадка выкупает предметы и продаёт их от своего имени. Укажите желаемую цену, размер, описание и приложите фото."
      />
      <Card>
        <CardSection>
          <BuyoutRequestForm />
        </CardSection>
      </Card>
    </div>
  );
}

export function RulesPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 leading-relaxed">
      <h1 className="text-3xl font-semibold">Правила площадки</h1>
      <p className="text-sm text-muted-foreground">Черновик. Полная редакция оферты и правил будет опубликована до запуска.</p>
      <h2 className="pt-2 text-xl font-semibold">Расчёты</h2>
      <p>
        Покупатель переводит деньги продавцу напрямую. Площадка не участвует в расчётах, не хранит деньги сделок и не разрешает денежные
        споры. Доход площадки — комиссия 1% с каждой продажи, которую продавец оплачивает ежемесячным счётом.
      </p>
      <h2 className="pt-2 text-xl font-semibold">Обязательства</h2>
      <p>
        Ставка и покупка обязывают выкупить лот. Ставку нельзя отозвать. На связь — 3 дня, на оплату — 7 дней. При неоплате продавец
        отмечает «Покупатель не оплатил», покупатель получает штрафной отзыв. Накопление штрафных отзывов ведёт к блокировке.
      </p>
      <h2 className="pt-2 text-xl font-semibold">Общение</h2>
      <p>
        Передача контактных данных (телефонов, email, ссылок, мессенджеров) в описаниях, вопросах и сообщениях запрещена: они
        автоматически скрываются. Нарушения можно отправить модератору кнопкой «Пожаловаться».
      </p>
      <h2 className="pt-2 text-xl font-semibold">Запрещённые предметы</h2>
      <p>
        Запрещена продажа предметов, оборот которых ограничен законодательством РФ, в том числе оружия и боеприпасов, наркотических
        веществ, культурных ценностей без права продажи, государственных наград РФ и СССР, чей оборот запрещён. Полный список — в
        редакции правил.
      </p>
      <h2 className="pt-2 text-xl font-semibold">Персональные данные</h2>
      <p>
        Данные хранятся на серверах в РФ. При удалении аккаунта имя, телефон и email удаляются, история торгов остаётся без привязки к
        человеку.
      </p>
    </article>
  );
}
