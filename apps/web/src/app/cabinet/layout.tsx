import type { ReactNode } from "react";
import { CabinetLayout } from "@/views/cabinet";

export const metadata = { title: "Личный кабинет" };

export default function Layout({ children }: { children: ReactNode }) {
  return <CabinetLayout>{children}</CabinetLayout>;
}
