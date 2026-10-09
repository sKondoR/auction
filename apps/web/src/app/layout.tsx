import type { Metadata } from "next";
import { Golos_Text, Old_Standard_TT } from "next/font/google";
import type { ReactNode } from "react";
import { Footer, Header } from "@/widgets/header";
import "./globals.css";

const body = Golos_Text({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700"], variable: "--font-body" });
const display = Old_Standard_TT({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: { default: "aucs.online — торги для коллекционеров", template: "%s · aucs.online" },
  description: "Площадка торгов монетами, банкнотами, марками и антиквариатом.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${body.variable} ${display.variable}`}>
      <body className="flex min-h-screen flex-col">
        <Header />
        <main className="wrap flex-1 pt-8 pb-16">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
