import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteCoin } from "../api/coins";
import { getErrorMessage, type ApiError } from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { toast } from "../store/toastStore";
import type { Coin } from "../types";

/**
 * Deletes a coin listing after the user confirms in a dialog.
 *
 * `requestDelete` opens the dialog; render `confirmDialog` (null while closed) next to the
 * delete button.
 */
export function useDeleteCoin(coin: Coin, onDeleted?: () => void) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: () => deleteCoin(coin.id),
    onSuccess: () => {
      setConfirming(false);
      queryClient.removeQueries({ queryKey: ["coin", coin.id] });
      // The listing also disappears from carts and favourites on the server.
      for (const key of ["coins", "coin-facets", "favourites", "cart"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast.success("Coin deleted.");
      onDeleted?.();
    },
    onError: (err: ApiError) => {
      setConfirming(false);
      toast.error(getErrorMessage(err));
    },
  });

  const confirmDialog = confirming ? (
    <ConfirmDialog
      title="Delete this coin?"
      message={
        <>
          <strong className="text-gray-900">{coin.name}</strong> will be removed from the shop together with its
          photos. This can't be undone.
        </>
      }
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      destructive
      isPending={mutation.isPending}
      onConfirm={() => mutation.mutate()}
      onCancel={() => setConfirming(false)}
    />
  ) : null;

  return {
    requestDelete: () => setConfirming(true),
    isPending: mutation.isPending,
    confirmDialog,
  };
}
