import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

const buttonVariants =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

export function Button(props: ButtonProps) {
  const {
    variant = "default",
    size = "default",
    asChild = false,
    className,
    ...propsRest
  } = props;

  const Comp = asChild
    ? React.forwardRef<HTMLButtonElement, any>((props, ref) => (
        <button ref={ref} {...props} />
      ))
    : "button";

  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "underline-offset-4 hover:underline text-primary",
  };

  const sizeStyles = {
    default: "min-h-10 px-4 py-2",
    sm: "min-h-9 px-3 py-1.5",
    lg: "min-h-11 px-8 py-2.5",
    icon: "size-10 p-0",
  };

  return (
    <Comp
      className={cn(
        buttonVariants,
        variants[variant],
        sizeStyles[size],
        "disabled:opacity-50 disabled:pointer-events-none",
        className
      )}
      {...propsRest}
    />
  );
}
