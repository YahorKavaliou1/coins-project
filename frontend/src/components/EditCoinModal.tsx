import { useEffect, useRef, useState } from "react";
import { ImagePlus, RotateCcw, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Coin, CoinUpdatePayload } from "../types";
import { updateCoin, uploadCoinImage, deleteCoinImage } from "../api/coins";
import { getErrorMessage, type ApiError } from "../api/client";
import { listCountries, listMetals } from "../api/reference";
import { toast } from "../store/toastStore";
import { toCountryOptions, toMetalOptions } from "../utils/referenceOptions";
import { MultiSelectDropdown } from "./MultiSelectDropdown";
import { inputClass, labelClass, sectionTitleClass } from "./formStyles";
import { CATEGORY_DATALIST_ID, CategoryDatalist } from "./CategoryDatalist";

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
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [countryId, setCountryId] = useState<number | null>(coin.country.id);
  const [metalId, setMetalId] = useState<number | null>(coin.metal.id);
  const [showRequiredErrors, setShowRequiredErrors] = useState(false);

  const queryClient = useQueryClient();
  const { data: countries } = useQuery({ queryKey: ["countries"], queryFn: listCountries });
  const { data: metals } = useQuery({ queryKey: ["metals"], queryFn: listMetals });
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
      category: coin.category ?? "",
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
      // Name, country and metal may have changed: refresh every view that shows this coin.
      queryClient.invalidateQueries({ queryKey: ["coin", coin.id] });
      queryClient.invalidateQueries({ queryKey: ["coins"] });
      queryClient.invalidateQueries({ queryKey: ["coin-facets"] });
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      onSaved();
    },
    onError: (err: ApiError) => {
      toast.error(getErrorMessage(err));
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

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    setNewImages((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  }

  function removePendingImage(id: string) {
    setNewImages((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  }

  function handleCancel() {
    if (saveMutation.isPending) return;
    newImages.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    onClose();
  }

  // Close on Escape.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  // Lock page scroll while the modal is open.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <form
        onSubmit={handleSubmit((data) => {
          if (countryId === null || metalId === null) {
            setShowRequiredErrors(true);
            toast.error("Country and metal are required.");
            return;
          }
          saveMutation.mutate({ ...data, country_id: countryId, metal_id: metalId });
        })}
        className="bg-gray-50 rounded-md shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-coin-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 bg-white border-b border-gray-200">
          <div className="min-w-0">
            <h2 id="edit-coin-title" className="text-xl font-bold">
              Edit coin
            </h2>
            <p className="text-sm text-gray-500 truncate">{coin.name}</p>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="p-1 text-gray-400 hover:text-gray-700"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          <section className="bg-white border border-gray-200 rounded-md p-5">
            <h3 className={sectionTitleClass}>Identification</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelClass}>Country</label>
                <MultiSelectDropdown
                  options={toCountryOptions(countries)}
                  selectedIds={countryId !== null ? [countryId] : []}
                  onChange={(ids) => setCountryId(ids[0] ?? null)}
                  placeholder="Select a country"
                  multiple={false}
                  hasError={showRequiredErrors && countryId === null}
                />
              </div>
              <div>
                <label className={labelClass}>Year</label>
                <input {...register("year", { valueAsNumber: true })} type="number" placeholder="e.g. 1990" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Denomination</label>
                <input {...register("denomination")} placeholder="e.g. 1 Dollar" className={inputClass} />
              </div>
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-md p-5">
            <h3 className={sectionTitleClass}>Physical characteristics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Metal</label>
                <MultiSelectDropdown
                  options={toMetalOptions(metals)}
                  selectedIds={metalId !== null ? [metalId] : []}
                  onChange={(ids) => setMetalId(ids[0] ?? null)}
                  placeholder="Select a metal"
                  multiple={false}
                  hasError={showRequiredErrors && metalId === null}
                />
              </div>
              <div>
                <label className={labelClass}>Composition</label>
                <input {...register("composition")} placeholder="e.g. 92.5% Ag, 7.5% Cu" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Weight</label>
                <div className="flex gap-2">
                  <input
                    {...register("weight", { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className={`${inputClass} w-2/3`}
                  />
                  <select {...register("weight_unit")} className={`${inputClass} w-1/3`}>
                    <option value="oz">oz</option>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Diameter (mm)</label>
                <input {...register("diameter", { valueAsNumber: true })} type="number" step="0.01" placeholder="0.00" className={inputClass} />
              </div>
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-md p-5">
            <h3 className={sectionTitleClass}>Grading &amp; details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Grade</label>
                <input {...register("grade")} placeholder="e.g. MS-65, XF-40" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Category</label>
                <input
                  {...register("category")}
                  list={CATEGORY_DATALIST_ID}
                  maxLength={50}
                  placeholder="e.g. Bullion, Commemorative"
                  autoComplete="off"
                  className={inputClass}
                />
                <CategoryDatalist />
              </div>
              <div>
                <label className={labelClass}>Catalog No.</label>
                <input {...register("catalog_number")} placeholder="e.g. KM# 123" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Mintage</label>
                <input {...register("mintage", { valueAsNumber: true })} type="number" placeholder="e.g. 500000" className={inputClass} />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Extra info</label>
                <input {...register("extra_info")} placeholder="e.g. Walking Liberty" className={inputClass} />
              </div>
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-md p-5">
            <h3 className={sectionTitleClass}>Photos</h3>

            {(coin.images.length > 0 || newImages.length > 0) && (
              <div className="flex flex-wrap gap-3 mb-4">
                {coin.images.map((img) => {
                  const isRemoved = removals.has(img.id);
                  return (
                    <div key={img.id} className="relative">
                      <img
                        src={img.url}
                        alt=""
                        className={`w-20 h-20 object-cover rounded border border-gray-200 ${
                          isRemoved ? "opacity-30 grayscale" : ""
                        }`}
                      />
                      {isRemoved && (
                        <span className="absolute inset-x-0 bottom-1 text-center text-[10px] font-bold uppercase text-red-700">
                          Removed
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleRemoval(img.id)}
                        className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white flex items-center justify-center ${
                          isRemoved ? "bg-gray-700" : "bg-red-700"
                        }`}
                        title={isRemoved ? "Undo remove" : "Remove"}
                      >
                        {isRemoved ? <RotateCcw className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      </button>
                    </div>
                  );
                })}
                {newImages.map((img) => (
                  <div key={img.id} className="relative">
                    <img
                      src={img.previewUrl}
                      alt=""
                      className="w-20 h-20 object-cover rounded border-2 border-dashed border-accent"
                    />
                    <span className="absolute left-1 bottom-1 bg-accent text-white text-[10px] font-bold uppercase px-1 rounded-sm">
                      New
                    </span>
                    <button
                      type="button"
                      onClick={() => removePendingImage(img.id)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-700 text-white flex items-center justify-center"
                      title="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
              }}
              className={`w-full flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-md py-5 transition-colors ${
                dragOver ? "border-accent bg-accent/5" : "border-gray-300 hover:border-accent hover:bg-gray-50"
              }`}
            >
              <ImagePlus className="w-6 h-6 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Click to upload or drag and drop</span>
              <span className="text-xs text-gray-400">JPEG, PNG or WEBP</span>
            </button>
          </section>

          <section className="bg-white border border-gray-200 rounded-md p-5">
            <h3 className={sectionTitleClass}>Price</h3>
            <div className="max-w-xs">
              <label className={labelClass}>Price (USD)</label>
              <input {...register("price", { valueAsNumber: true })} type="number" step="0.01" placeholder="0.00" className={inputClass} />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-white border-t border-gray-200">
          <button
            type="button"
            onClick={handleCancel}
            disabled={saveMutation.isPending}
            className="px-5 py-2.5 border border-gray-300 rounded-sm text-sm font-bold uppercase tracking-wide text-gray-700 hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="px-5 py-2.5 bg-accent hover:bg-accent-dark text-white rounded-sm text-sm font-bold uppercase tracking-wide disabled:opacity-50"
          >
            {saveMutation.isPending ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
