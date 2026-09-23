import "server-only";
import { account, getDb, session, user, verification } from "@auction/db";
import { getSms } from "@auction/services";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { phoneNumber } from "better-auth/plugins/phone-number";

/**
 * Вход по телефону и одноразовому SMS-коду (ADR 0007). Новый пользователь
 * создаётся при первой успешной проверке кода; подтверждённый телефон —
 * верификация для торгов.
 */
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  session: {
    // Долгие сессии: SMS — главная статья расходов.
    expiresIn: 60 * 60 * 24 * 90,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/phone-number/send-otp": { window: 60, max: 3 },
      "/phone-number/verify": { window: 60, max: 10 },
    },
  },
  plugins: [
    phoneNumber({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 5,
      sendOTP: ({ phoneNumber, code }) => {
        // Не ждём отправку: ответ не должен зависеть от провайдера (тайминг-атаки).
        void getSms()
          .send(phoneNumber, `Код входа: ${code}`)
          .catch((e) => console.error("[sms]", e));
      },
      signUpOnVerification: {
        getTempEmail: (phone) => `${phone.replace(/\D/g, "")}@phone.local`,
        getTempName: () => "Новый пользователь",
      },
    }),
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    nextCookies(),
  ],
});
