import * as React from "react";
import { cn } from "@/lib/utils";

export function LoadingSkeleton({
  className,
  width = "100%",
  height = "1rem",
}: {
  className?: string;
  width?: string;
  height?: string;
}) {
  const heightClass =
    height === "1rem"
      ? "h-8"
      : height === "0.5rem"
        ? "h-4"
        : "";

  return (
    <div
      className={cn(
        "bg-muted/30 rounded-lg animate-pulse",
        heightClass,
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
    <div
      className={cn(
        sizeMap[size],
        "rounded-full",
        "bg-muted/30",
        className
      )}
    />
  );
}
