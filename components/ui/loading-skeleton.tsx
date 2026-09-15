import * as React from "react";

export function LoadingSkeleton({
  className,
  width = "100%",
  height = "1rem",
}: {
  className?: string;
  width?: string;
  height?: string;
}) {
  return (
    <div
      className={cn(
        "bg-muted/30 rounded-lg animate-pulse",
        {
          "h-8": height === "1rem",
          "h-4": height === "0.5rem",
        },
        width,
        className
      )}
    />
  );
}

export function SkeletonAvatar({
  className,
  size = "lg",
}: {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizeMap = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
    xl: "h-12 w-12",
  };

  return (
    <div className={cn(sizeMap[size], "rounded-full", "bg-muted/30", className)} />
  );
}