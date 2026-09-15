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
      className={cn(inputVariants[variant], className)}
      {...propsRest}
    />
  );
}