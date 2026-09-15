import * as React from "react";
import { cn } from "@/lib/utils";

export interface DialogProps extends React.DialogHTMLAttributes<HTMLDialogElement> {
  title?: React.ReactNode;
}

export function Dialog({
  title,
  children,
  className,
  ...props
}: DialogProps) {
  return (
    <div className="space-y-2">
      <Dialog open={true} onOpenCancel={() => {}} className={cn("max-w-lg", className)} {...props}>
        <form>
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
          </DialogHeader>
          <DialogContent>{children}</DialogContent>
          <DialogFooter>
            <Button variant="outline" type="button">Cancel</Button>
            <Button>Confirm</Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}

export interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function DialogHeader({
  className,
  children,
}: DialogHeaderProps) {
  return <div className={cn("flex flex-col space-y-1.5 p-6 pt-0", className)}>{children}</div>;
}

export interface DialogTitleProps extends React.HTMLAttributes<HTMLTitleElement> {
  className?: string;
}

export function DialogTitle({
  className,
  children,
}: DialogTitleProps) {
  return <h3 className={cn("text-xl font-semibold", className)}>{children}</h3>;
}

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function DialogContent({
  className,
  children,
}: DialogContentProps) {
  return <div className={cn("p-6 pt-0", className)}>{children}</div>;
}

export interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function DialogFooter({
  className,
  children,
}: DialogFooterProps) {
  return <div className={cn("flex justify-end p-6 pt-0", className)}>{children}</div>;
}