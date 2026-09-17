'use client';

import { useCallback, useRef, useState } from 'react';
import { BellRing, X } from 'lucide-react';

export type ToastInput = {
  id?: string;
  title: string;
  message: string;
  href?: string;
  actionLabel?: string;
};

export type Toast = {
  id: string;
  title: string;
  message: string;
  href?: string;
  actionLabel?: string;
};

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const toast: Toast = {
        id: input.id || newId(),
        title: input.title,
        message: input.message,
        href: input.href,
        actionLabel: input.actionLabel,
      };
      setToasts((current) => [...current.slice(-2), toast]);
      if (typeof window !== 'undefined') {
        const timer = window.setTimeout(() => dismiss(toast.id), 6000);
        timers.current.set(toast.id, timer);
      }
      return toast.id;
    },
    [dismiss]
  );

  return { toasts, push, dismiss };
}

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed right-4 top-20 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 md:right-6 md:top-24">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-lg backdrop-blur toast-enter"
        >
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[#ffe4e4] text-[#b91c1c]">
            <BellRing size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{toast.message}</p>
            {toast.href && (
              <a
                href={toast.href}
                onClick={() => onDismiss(toast.id)}
                className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[#b91c1c] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#991b1b]"
              >
                {toast.actionLabel || 'Open'}
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
            className="-m-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-stone-100 hover:text-slate-700"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}