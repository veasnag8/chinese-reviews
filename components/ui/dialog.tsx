import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface DialogProps
  extends Omit<React.DialogHTMLAttributes<HTMLDialogElement>, "title"> {
  title?: React.ReactNode;
}

export function Dialog({
  title,
  children,
  className,
  ...props
}: DialogProps) {
  return (
    <dialog
      open
      className={cn(
        "w-full max-w-lg rounded-lg border bg-background p-0 shadow-lg",
        className
      )}
      {...props}
    >
      <form method="dialog">
        {title && (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}

        <DialogContent>{children}</DialogContent>

        <DialogFooter>
          <Button variant="outline" value="cancel">
            Cancel
          </Button>
          <Button value="confirm">Confirm</Button>
        </DialogFooter>
      </form>
    </dialog>
  );
}

export interface DialogHeaderProps
  extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function DialogHeader({
  className,
  children,
  ...props
}: DialogHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col space-y-1.5 p-6 pb-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface DialogTitleProps
  extends React.HTMLAttributes<HTMLHeadingElement> {
  className?: string;
}

export function DialogTitle({
  className,
  children,
  ...props
}: DialogTitleProps) {
  return (
    <h3
      className={cn("text-xl font-semibold", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export interface DialogContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function DialogContent({
  className,
  children,
  ...props
}: DialogContentProps) {
  return (
    <div
      className={cn("p-6 pt-0", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export interface DialogFooterProps
  extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function DialogFooter({
  className,
  children,
  ...props
}: DialogFooterProps) {
  return (
    <div
      className={cn(
        "flex justify-end gap-2 p-6 pt-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
