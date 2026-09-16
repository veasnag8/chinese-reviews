import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "outline" | "underlined";
}

const inputVariants = {
  default: "flex h-10 w-full rounded-md border border-input px-3 py-2 placeholder-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-disabled",
  outline: "flex h-10 w-full rounded-md border-2 border-border bg-transparent px-3 py-2 placeholder-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-disabled",
  underlined: "h-10 w-full px-3 py-2 .placeholder-muted-underline",
};

export function Input(props: InputProps) {
  const { variant = "default", className, ...propsRest } = props;

  return (
    <input
      className={cn(
        inputVariants[variant],
        variant === "underlined" &&
          "border-0 border-b border-slate-200 bg-transparent px-0 py-2.5 text-base text-slate-700 shadow-none transition-all duration-200 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none",
        className
      )}
      {...propsRest}
    />
  );
}