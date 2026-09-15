import * as React from "react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  description,
  actionText = "Try again",
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("text-center py-12", className)}>
      <p className="text-4xl mb-2">{title}</p>
      {description && <p className="text-muted-foreground mb-6">{description}</p>}
      {onAction && (
        <Button onClick={onAction}>{actionText}</Button>
      )}
    </div>
  );
}