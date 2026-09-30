import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, LockOpen } from "lucide-react";
import { blockUser, unblockUser } from "../api/users";
import { getErrorMessage, type ApiError } from "../api/client";
import { toast } from "../store/toastStore";
import { formatUtcDateTime } from "../utils/dates";
import { blockReasonLabel } from "../utils/roles";
import type { User } from "../types";

export function UserStatusBadge({ user }: { user: User }) {
  if (!user.is_blocked) {
    return (
      <span className="inline-block px-2 py-1 rounded text-xs font-semibold uppercase bg-green-100 text-green-800">
        Active
      </span>
    );
  }
  const details = [
    blockReasonLabel(user.blocked_reason),
    user.blocked_at ? formatUtcDateTime(user.blocked_at) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold uppercase bg-red-100 text-red-800"
      title={details}
    >
      <Lock className="w-3 h-3" />
      Blocked
    </span>
  );
}

interface BlockToggleButtonProps {
  user: User;
  size?: "sm" | "md";
}

export function BlockToggleButton({ user, size = "sm" }: BlockToggleButtonProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => (user.is_blocked ? unblockUser(user.id) : blockUser(user.id)),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user", updated.id] });
      toast.success(`${updated.email} ${updated.is_blocked ? "blocked" : "unblocked"}.`);
    },
    onError: (err: ApiError) => toast.error(getErrorMessage(err)),
  });

  const sizeClass = size === "sm" ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm";
  const colorClass = user.is_blocked
    ? "border-gray-300 text-gray-700 hover:border-accent hover:text-accent"
    : "border-red-300 text-red-700 hover:bg-red-700 hover:border-red-700 hover:text-white";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        mutation.mutate();
      }}
      disabled={mutation.isPending}
      className={`inline-flex items-center gap-1.5 border rounded-sm font-bold uppercase tracking-wide transition-colors disabled:opacity-50 ${sizeClass} ${colorClass}`}
    >
      {user.is_blocked ? <LockOpen className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
      {user.is_blocked ? "Unblock" : "Block"}
    </button>
  );
}
