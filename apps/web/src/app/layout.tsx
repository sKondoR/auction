import type { Metadata } from "next";
import { PT_Sans, PT_Serif } from "next/font/google";
import type { ReactNode } from "react";
import { Footer, Header } from "@/widgets/header";
import "./globals.css";

const body = PT_Sans({ subsets: ["latin", "cyrillic"], weight: ["400", "700"], variable: "--font-body" });
const display = PT_Serif({ subsets: ["latin", "cyrillic"], weight: ["400", "700"], variable: "--font-display" });

export const metadata: Metadata = {
  title: { default: "Аукцион — торги для коллекционеров", template: "%s · Аукцион" },
  description: "Площадка торгов монетами, банкнотами, марками и антиквариатом.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${body.variable} ${display.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        <Header />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
