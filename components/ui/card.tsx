import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps {
  className?: string;
  title?: React.ReactNode;
}

export function Card({
  className,
  title,
  children,
}: CardProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-6 shadow-sm", className)}>
      {title && <div className="flex flex-col gap-2 mb-4">
        <h3 className="text-lg font-medium">{title}</h3>
      </div>}
      <div>{children}</div>
    </div>
  );
}