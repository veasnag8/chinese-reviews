import * as React from "react";
import { cn } from "@/lib/utils";

export interface ToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
}

export function Toggle({
  className,
  ...props
}: ToggleProps) {
  return (
    <button
      className={cn("flex items-center justify-center rounded-full border-2 border-border bg-transparent px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:pointer-disabled", className)}
      {...props}
    >
      <span className="sr-only">Toggle</span>
      <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
        <path fill="currentColor" d="M12 3l5 5-1.4 1.4a2 2 0 0 1-2.8 0L12 3Z" />
        <path fill="currentColor" d="M19 14l-5 5 1.4 1.4a2 2 0 0 1-2.8 0L19 14Z" />
      </svg>
    </button>
  );
}