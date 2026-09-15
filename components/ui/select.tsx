import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  searchable?: boolean;
}

export function Select({
  options,
  searchable = false,
  className,
  ...props
}: SelectProps) {
  return (
    <div className="relative">
      <select className={cn("rounded-md border bg-background px-3 py-2 placeholder-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 w-full disabled:opacity-50 disabled:pointer-disabled", className)} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {searchable && <SearchPlaceholder />}
    </div>
  );
}

function SearchPlaceholder() {
  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
      🔍
    </div>
  );
}