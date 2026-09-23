/** SMS-провайдер за адаптером (ADR 0007). Локально коды пишутся в консоль. */
export interface SmsSender {
  send(phone: string, text: string): Promise<void>;
}

class ConsoleSms implements SmsSender {
  async send(phone: string, text: string): Promise<void> {
    console.log(`\n📱 [SMS → ${phone}] ${text}\n`);
  }
}

/** SMS.ru — пример реального провайдера; включается SMS_PROVIDER=smsru. */
class SmsRu implements SmsSender {
  constructor(private readonly apiId: string) {}
  async send(phone: string, text: string): Promise<void> {
    const url = new URL("https://sms.ru/sms/send");
    url.searchParams.set("api_id", this.apiId);
    url.searchParams.set("to", phone.replace(/\D/g, ""));
    url.searchParams.set("msg", text);
    url.searchParams.set("json", "1");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`SMS.ru: HTTP ${res.status}`);
  }
}

let sender: SmsSender | null = null;

export function getSms(): SmsSender {
  if (!sender) {
    sender =
      process.env.SMS_PROVIDER === "smsru" && process.env.SMSRU_API_ID
        ? new SmsRu(process.env.SMSRU_API_ID)
        : new ConsoleSms();
  }
  return sender;
}

/** Нормализация российского номера к виду +7XXXXXXXXXX; null — номер некорректен. */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("8") || digits.startsWith("7"))) digits = `7${digits.slice(1)}`;
  else if (digits.length === 10 && digits.startsWith("9")) digits = `7${digits}`;
  else return null;
  return `+${digits}`;
}
