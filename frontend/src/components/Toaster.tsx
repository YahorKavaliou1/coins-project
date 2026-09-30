import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { useToastStore } from "../store/toastStore";

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2.5rem)]">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.type === "error" ? "alert" : "status"}
          className={`flex items-start gap-2 bg-white border-l-4 shadow-lg rounded-sm px-4 py-3 text-sm text-gray-800 ${
            t.type === "error" ? "border-red-600" : "border-green-600"
          }`}
        >
          {t.type === "error" ? (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          )}
          <span className="flex-1 break-words">{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="text-gray-400 hover:text-gray-700"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
