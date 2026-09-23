import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function mailer(): Transporter {
  transporter ??= nodemailer.createTransport(process.env.SMTP_URL ?? "smtp://localhost:1025");
  return transporter;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  await mailer().sendMail({
    from: process.env.EMAIL_FROM ?? "Аукцион <no-reply@auction.local>",
    ...msg,
  });
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Простой шаблон письма-уведомления. */
export function notificationEmail(p: { title: string; body: string; link: string | null }): { text: string; html: string } {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const href = p.link ? new URL(p.link, appUrl).toString() : appUrl;
  const text = `${p.title}\n\n${p.body}\n\n${href}\n\nНастроить уведомления: ${appUrl}/cabinet/settings`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px">
<h2 style="font-size:18px">${escapeHtml(p.title)}</h2>
<p style="white-space:pre-line">${escapeHtml(p.body)}</p>
<p><a href="${escapeHtml(href)}" style="display:inline-block;padding:10px 16px;background:#7c2d12;color:#fff;border-radius:6px;text-decoration:none">Открыть</a></p>
<p style="color:#888;font-size:12px">Настроить уведомления: <a href="${appUrl}/cabinet/settings">${appUrl}/cabinet/settings</a></p>
</div>`;
  return { text, html };
}
