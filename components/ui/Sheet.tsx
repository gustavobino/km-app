"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/** Bottom sheet built on <dialog> (focus trap, Esc and backdrop close for free). */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-ink/40 sm:mx-auto sm:max-w-column"
    >
      <div className="mx-auto w-full max-w-column rounded-t-hero bg-bg px-5 pt-3 pb-[calc(20px+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[24px] font-extrabold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-2.5 flex size-touch items-center justify-center"
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-gap-card">{children}</div>
      </div>
    </dialog>
  );
}
