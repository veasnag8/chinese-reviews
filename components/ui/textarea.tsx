import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaAttributes<HTMLTextAreaElement> {
  className?: string;
}

export function Textarea({
  className,
  ...props
}: TextareaProps) {
  return (
    <textarea
      className={cn("rounded-md border bg-background px-3 py-2 placeholder-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 w-full min-h-[80px] disabled:opacity-50 disabled:pointer-disabled", className)}
      {...props}
    />
  );
}