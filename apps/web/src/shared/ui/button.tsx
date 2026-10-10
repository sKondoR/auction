import { type VariantProps, cva } from "class-variance-authority";
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "../lib";

/** Кнопки по DESIGN.md: 8px, 48px, синий action — единственный цвет действия, сургуч — только срочность. */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold leading-tight transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50 cursor-pointer [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-action text-white hover:bg-action-hover",
        secondary: "border border-primary bg-surface text-primary hover:bg-sage-mist",
        outline: "border border-border bg-surface text-foreground hover:border-border-strong hover:bg-sage-mist",
        ghost: "text-foreground hover:bg-sage-mist",
        urgent: "bg-wax text-white hover:bg-wax-deep",
        gold: "bg-gold text-gold-foreground hover:bg-gold-light",
        danger: "border border-wax bg-surface text-wax hover:bg-wax-soft",
        light: "bg-surface text-primary hover:bg-sage-mist",
        field: "border border-gold-light bg-transparent text-white text-[0.8125rem] uppercase tracking-[0.08em] hover:border-gold hover:bg-gold hover:text-primary-hover",
        link: "px-0 font-medium text-primary underline decoration-1 underline-offset-[3px] hover:decoration-2",
      },
      size: {
        sm: "min-h-10 px-4 text-[0.9375rem]",
        md: "min-h-12 px-6 text-base",
        lg: "min-h-12 px-6 text-base",
        icon: "size-11 rounded-full",
      },
    },
    compoundVariants: [{ variant: "link", className: "min-h-0 px-0" }],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Variants = VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ComponentProps<"button"> & Variants) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function ButtonLink({ className, variant, size, ...props }: ComponentProps<typeof Link> & Variants) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
