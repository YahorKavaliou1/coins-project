import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  /** Shown on the confirm button while the action runs. */
  pendingLabel?: string;
  /** Red confirm button and warning icon, for actions that can't be undone. */
  destructive?: boolean;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** The site's replacement for window.confirm, styled like the other modals (EditCoinModal). */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  pendingLabel,
  destructive = false,
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  function cancel() {
    if (!isPending) onCancel();
  }

  // Close on Escape; focus Cancel, so Enter never confirms by accident.
  useEffect(() => {
    cancelRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") cancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  // Lock page scroll while the dialog is open.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const confirmClass = destructive
    ? "bg-red-700 hover:bg-red-800 text-white"
    : "bg-accent hover:bg-accent-dark text-white";

  // A portal keeps the dialog out of the page layout (e.g. a coin card's grid cell). React
  // events still bubble through the component tree, so clicks are stopped here: otherwise a
  // click in the dialog would also count as a click on the card that opened it.
  return createPortal(
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cancel();
      }}
    >
      <div
        className="bg-gray-50 rounded-md shadow-xl max-w-md w-full flex flex-col overflow-hidden"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 bg-white border-b border-gray-200">
          <h2 id="confirm-dialog-title" className="text-xl font-bold flex items-center gap-2">
            {destructive && <AlertTriangle className="w-5 h-5 text-red-700 shrink-0" />}
            {title}
          </h2>
          <button type="button" onClick={cancel} className="p-1 text-gray-400 hover:text-gray-700" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div id="confirm-dialog-message" className="px-6 py-5 text-sm text-gray-700 leading-relaxed">
          {message}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 bg-white border-t border-gray-200">
          <button
            ref={cancelRef}
            type="button"
            onClick={cancel}
            disabled={isPending}
            className="border border-gray-300 text-gray-700 hover:border-accent hover:text-accent font-bold uppercase tracking-wide text-sm rounded-sm px-5 py-2.5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={`${confirmClass} font-bold uppercase tracking-wide text-sm rounded-sm px-5 py-2.5 disabled:opacity-50`}
          >
            {isPending && pendingLabel ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
