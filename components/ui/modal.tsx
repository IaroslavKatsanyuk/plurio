"use client";

import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

export function Modal({ open, onClose, title, children }: Props) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Закрити модальне вікно"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 w-full max-w-2xl rounded-2xl border border-violet-800/70 bg-gradient-to-b from-[#2a1050] to-[#170a2d] p-5 text-violet-50 shadow-xl",
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-violet-50">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-violet-300 hover:bg-violet-800/60 hover:text-violet-100"
          >
            Закрити
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
