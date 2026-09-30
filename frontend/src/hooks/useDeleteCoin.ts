import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteCoin } from "../api/coins";
import { getErrorMessage, type ApiError } from "../api/client";
import { toast } from "../store/toastStore";
import type { Coin } from "../types";

/** Deletes a coin listing after the user confirms. Returns `requestDelete` and `isPending`. */
export function useDeleteCoin(coin: Coin, onDeleted?: () => void) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteCoin(coin.id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["coin", coin.id] });
      // The listing also disappears from carts and favourites on the server.
      for (const key of ["coins", "coin-facets", "favourites", "cart"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast.success("Coin deleted.");
      onDeleted?.();
    },
    onError: (err: ApiError) => toast.error(getErrorMessage(err)),
  });

  function requestDelete() {
    if (window.confirm(`Delete "${coin.name}"? Its photos are deleted too. This can't be undone.`)) {
      mutation.mutate();
    }
  }

  return { requestDelete, isPending: mutation.isPending };
}
