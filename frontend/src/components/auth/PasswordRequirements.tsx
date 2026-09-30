import { Check, X } from "lucide-react";
import { PASSWORD_RULES } from "../../utils/password";

/** Live checklist under a new-password field. `showErrors` turns unmet rules red after submit. */
export function PasswordRequirements({ password, showErrors = false }: { password: string; showErrors?: boolean }) {
  return (
    <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        const color = ok ? "text-green-700" : showErrors ? "text-red-700" : "text-gray-400";
        return (
          <li key={rule.label} className={`flex items-center gap-1.5 text-xs ${color}`}>
            {ok ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
