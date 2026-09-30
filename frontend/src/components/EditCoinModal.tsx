import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import type { Coin, CoinUpdatePayload } from "../types";
import { updateCoin, uploadCoinImage, deleteCoinImage } from "../api/coins";
import type { ApiError } from "../api/client";

interface EditCoinModalProps {
  coin: Coin;
  onClose: () => void;
  onSaved: () => void;
}

interface PendingNewImage {
  id: string;
  file: File;
  previewUrl: string;
}

export function EditCoinModal({ coin, onClose, onSaved }: EditCoinModalProps) {
  const [removals, setRemovals] = useState<Set<number>>(new Set());
  const [newImages, setNewImages] = useState<PendingNewImage[]>([]);
  const { register, handleSubmit } = useForm<CoinUpdatePayload>({
    defaultValues: {
      denomination: coin.denomination ?? "",
      year: coin.year,
      weight: coin.weight,
      weight_unit: coin.weight_unit,
      composition: coin.composition ?? "",
      diameter: coin.diameter ?? undefined,
      mintage: coin.mintage ?? undefined,
      grade: coin.grade ?? "",
      catalog_number: coin.catalog_number ?? "",
      extra_info: coin.extra_info ?? "",
      price: coin.price ?? undefined,
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: CoinUpdatePayload) => {
      await updateCoin(coin.id, data);
      for (const imageId of removals) {
        await deleteCoinImage(coin.id, imageId);
      }
      for (const pending of newImages) {
        await uploadCoinImage(coin.id, pending.file);
      }
    },
    onSuccess: () => {
      newImages.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      onSaved();
    },
    onError: (err: ApiError) => {
      alert(`Error: ${err.response?.data?.detail || "unknown error"}`);
    },
  });

  function toggleRemoval(imageId: number) {
    setRemovals((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setNewImages((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
    e.target.value = "";
  }

  function removePendingImage(id: string) {
    setNewImages((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  }

  function handleCancel() {
    newImages.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-5 max-h-[90vh] overflow-y-auto">
        <h2 className="font-semibold text-lg mb-3">Edit coin</h2>

        <h3 className="font-medium mb-2">Photos</h3>
        <div className="flex flex-wrap gap-2 mb-2">
          {coin.images.map((img) => {
            const isRemoved = removals.has(img.id);
            return (
              <div key={img.id} className="relative">
                <img
                  src={img.url}
                  alt=""
                  className={`w-16 h-16 object-cover rounded border ${isRemoved ? "opacity-30 grayscale" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => toggleRemoval(img.id)}
                  className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-xs ${
                    isRemoved ? "bg-blue-700" : "bg-red-700"
                  }`}
                  title={isRemoved ? "Undo remove" : "Remove"}
                >
                  {isRemoved ? "↺" : "x"}
                </button>
              </div>
            );
          })}
          {newImages.map((img) => (
            <div key={img.id} className="relative">
              <img src={img.previewUrl} alt="" className="w-16 h-16 object-cover rounded border-2 border-dashed border-blue-500" />
              <button
                type="button"
                onClick={() => removePendingImage(img.id)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-700 text-white text-xs"
                title="Cancel"
              >
                x
              </button>
            </div>
          ))}
        </div>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFileSelect} className="text-sm mb-4" />

        <h3 className="font-medium mb-2">Details</h3>
        <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="flex flex-col gap-2">
          <input {...register("denomination")} placeholder="Denomination" className="border rounded p-2" />
          <input {...register("year", { valueAsNumber: true })} type="number" placeholder="Year" className="border rounded p-2" />
          <div className="flex gap-2">
            <input {...register("weight", { valueAsNumber: true })} type="number" step="0.01" placeholder="Weight" className="border rounded p-2 flex-1" />
            <select {...register("weight_unit")} className="border rounded p-2">
              <option value="oz">oz</option>
              <option value="g">g</option>
              <option value="kg">kg</option>
            </select>
          </div>
          <input {...register("composition")} placeholder="Composition" className="border rounded p-2" />
          <input {...register("diameter", { valueAsNumber: true })} type="number" step="0.01" placeholder="Diameter (mm)" className="border rounded p-2" />
          <input {...register("mintage", { valueAsNumber: true })} type="number" placeholder="Mintage" className="border rounded p-2" />
          <input {...register("grade")} placeholder="Grade" className="border rounded p-2" />
          <input {...register("catalog_number")} placeholder="Catalog No." className="border rounded p-2" />
          <input {...register("extra_info")} placeholder="Extra info" className="border rounded p-2" />
          <input {...register("price", { valueAsNumber: true })} type="number" step="0.01" placeholder="Price" className="border rounded p-2" />

          <div className="flex gap-2 mt-2">
            <button type="submit" className="flex-1 bg-blue-700 hover:bg-blue-600 text-white rounded p-2">
              Save
            </button>
            <button type="button" onClick={handleCancel} className="flex-1 bg-gray-400 hover:bg-gray-500 text-white rounded p-2">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
