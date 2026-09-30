import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MailCheck, MailWarning, Send } from "lucide-react";
import { resendUserVerification, verifyUserManually } from "../api/users";
import { getErrorMessage, type ApiError } from "../api/client";
import { toast } from "../store/toastStore";
import type { User } from "../types";

export function EmailStatusBadge({ user }: { user: User }) {
  return user.is_verified ? (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold uppercase bg-green-100 text-green-800">
      <MailCheck className="w-3 h-3" />
      Confirmed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold uppercase bg-amber-100 text-amber-800">
      <MailWarning className="w-3 h-3" />
      Unconfirmed
    </span>
  );
}

const buttonClass =
  "inline-flex items-center gap-1.5 border border-gray-300 rounded-sm px-4 py-2 text-sm font-bold uppercase tracking-wide text-gray-700 hover:border-accent hover:text-accent transition-colors disabled:opacity-50";

/** Support actions for a user whose email isn't confirmed yet. */
export function EmailVerificationActions({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["user", user.id] });
  };

  const resend = useMutation({
    mutationFn: () => resendUserVerification(user.id),
    onSuccess: (data) => toast.success(data.message),
    onError: (err: ApiError) => toast.error(getErrorMessage(err)),
  });
  const verify = useMutation({
    mutationFn: () => verifyUserManually(user.id),
    onSuccess: () => {
      refresh();
      toast.success(`${user.email} marked as confirmed.`);
    },
    onError: (err: ApiError) => toast.error(getErrorMessage(err)),
  });

  if (user.is_verified) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => resend.mutate()} disabled={resend.isPending} className={buttonClass}>
        <Send className="w-3.5 h-3.5" />
        Resend confirmation
      </button>
      <button type="button" onClick={() => verify.mutate()} disabled={verify.isPending} className={buttonClass}>
        <MailCheck className="w-3.5 h-3.5" />
        Mark as confirmed
      </button>
    </div>
  );
}
