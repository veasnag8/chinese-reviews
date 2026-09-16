import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  actionText = "Try again",
  onAction,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div className={cn("text-center py-12", className)}>
      {title && <p className="text-4xl mb-2">{title}</p>}

      {description && (
        <p className="text-muted-foreground mb-6">
          {description}
        </p>
      )}

      {children}

      {onAction && (
        <Button onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
}
