import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { listCountries, listMetals } from "../api/reference";
import { createCoin, uploadCoinImage } from "../api/coins";
import { MultiSelectDropdown } from "../components/MultiSelectDropdown";
import { inputClass, labelClass } from "../components/formStyles";
import { toCountryOptions, toMetalOptions } from "../utils/referenceOptions";
import type { CoinCreatePayload } from "../types";
import { getErrorMessage, type ApiError } from "../api/client";
import { toast } from "../store/toastStore";
import { useSearchParams } from "react-router-dom";
import { BatchImport } from "../components/batch/BatchImport";
import { CATEGORY_DATALIST_ID, CategoryDatalist } from "../components/CategoryDatalist";

interface FormValues extends Omit<CoinCreatePayload, "country_id" | "metal_id"> {
  country_id: string;
  metal_id: string;
}


function Required() {
  return <span className="text-accent">*</span>;
}

function SingleListingForm() {
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(newFiles: FileList | File[]) {
    const asArray = Array.from(newFiles);
    console.log("addFiles: newFiles.length =", newFiles.length, "asArray.length =", asArray.length, asArray);
    setFiles((prev) => {
      const combined = [...prev, ...asArray];
      console.log("setFiles updater: prev =", prev.length, "combined =", combined.length);
      return combined;
    });
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }
  const { data: countries } = useQuery({ queryKey: ["countries"], queryFn: listCountries });
  const { data: metals } = useQuery({ queryKey: ["metals"], queryFn: listMetals });

  const [countrySelection, setCountrySelection] = useState<number[]>([]);
  const [metalSelection, setMetalSelection] = useState<number[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { weight_unit: "oz", country_id: "", metal_id: "" },
  });

  function handleCountryChange(ids: number[]) {
    setCountrySelection(ids);
    setValue("country_id", ids[0] ? String(ids[0]) : "", { shouldValidate: true });
  }

  function handleMetalChange(ids: number[]) {
    setMetalSelection(ids);
    setValue("metal_id", ids[0] ? String(ids[0]) : "", { shouldValidate: true });
  }

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const coin = await createCoin({
        ...data,
        country_id: parseInt(data.country_id, 10),
        metal_id: parseInt(data.metal_id, 10),
        year: Number(data.year),
        weight: Number(data.weight),
        diameter: data.diameter ? Number(data.diameter) : null,
        mintage: data.mintage ? Number(data.mintage) : null,
        price: Number(data.price),
      });
      for (const file of files) {
        await uploadCoinImage(coin.id, file);
      }
      return coin;
    },
    onSuccess: () => {
      reset();
      setFiles([]);
      setCountrySelection([]);
      setMetalSelection([]);
      toast.success("Coin listed successfully.");
    },
    onError: (err: ApiError) => {
      toast.error(getErrorMessage(err));
    },
  });

  const countryOptions = toCountryOptions(countries);
  const metalOptions = toMetalOptions(metals);

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-gray-500 mb-6">Fields marked with <Required /> are required.</p>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="flex flex-col gap-6">
        {/* Identification */}
        <section className="bg-white border border-gray-200 rounded-md p-5 max-sm:p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-4">Identification</h2>
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <div className="col-span-2 max-sm:col-span-1">
              <label className={labelClass}>
                Country <Required />
              </label>
              <input
                type="hidden"
                {...register("country_id", { required: true })}
              />
              <MultiSelectDropdown
                options={countryOptions}
                selectedIds={countrySelection}
                onChange={handleCountryChange}
                placeholder="Select a country"
                multiple={false}
                hasError={!!errors.country_id}
              />
            </div>

            <div>
              <label className={labelClass}>
                Year <Required />
              </label>
              <input
                {...register("year", { required: true })}
                type="number"
                placeholder="e.g. 1990"
                className={`${inputClass} ${errors.year ? "border-red-400" : ""}`}
              />
            </div>

            <div>
              <label className={labelClass}>Denomination</label>
              <input {...register("denomination")} placeholder="e.g. 1 Dollar" className={inputClass} />
            </div>
          </div>
        </section>

        {/* Physical characteristics */}
        <section className="bg-white border border-gray-200 rounded-md p-5 max-sm:p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-4">Physical characteristics</h2>
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <div>
              <label className={labelClass}>
                Metal <Required />
              </label>
              <input type="hidden" {...register("metal_id", { required: true })} />
              <MultiSelectDropdown
                options={metalOptions}
                selectedIds={metalSelection}
                onChange={handleMetalChange}
                placeholder="Select a metal"
                multiple={false}
                hasError={!!errors.metal_id}
              />
            </div>

            <div>
              <label className={labelClass}>Composition</label>
              <input
                {...register("composition")}
                placeholder="e.g. 92.5% Ag, 7.5% Cu"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Weight <Required />
              </label>
              <div className="flex gap-2">
                <input
                  {...register("weight", { required: true })}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className={`${inputClass} w-2/3 ${errors.weight ? "border-red-400" : ""}`}
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
              <input {...register("diameter")} type="number" step="0.01" placeholder="0.00" className={inputClass} />
            </div>
          </div>
        </section>

        {/* Grading & details */}
        <section className="bg-white border border-gray-200 rounded-md p-5 max-sm:p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-4">Grading &amp; details</h2>
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
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
              <input {...register("mintage")} type="number" placeholder="e.g. 500000" className={inputClass} />
            </div>

            <div className="col-span-2 max-sm:col-span-1">
              <label className={labelClass}>Extra info</label>
              <input {...register("extra_info")} placeholder="e.g. Walking Liberty" className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>SKU</label>
              <input {...register("sku")} maxLength={100} placeholder="Your own reference, e.g. A-0153" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Source link</label>
              <input
                {...register("source_url")}
                type="url"
                maxLength={500}
                placeholder="https://en.numista.com/…"
                className={inputClass}
              />
            </div>
          </div>
        </section>

        {/* Photos */}
        <section className="bg-white border border-gray-200 rounded-md p-5 max-sm:p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-4">Photos</h2>

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
            className={`w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-md py-8 transition-colors ${
              dragOver ? "border-accent bg-accent/5" : "border-gray-300 hover:border-accent hover:bg-gray-50"
            }`}
          >
            <ImagePlus className="w-8 h-8 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Click to upload or drag and drop</span>
            <span className="text-xs text-gray-400">JPEG, PNG or WEBP</span>
          </button>

          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {files.map((file, idx) => (
                <div key={`${file.name}-${idx}`} className="relative">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-16 h-16 object-cover rounded border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-700 text-white text-xs flex items-center justify-center"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Price & submit */}
        <section className="bg-white border border-gray-200 rounded-md p-5 max-sm:p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-4">Price</h2>
          <div className="max-w-xs">
            <label className={labelClass}>
              Price (USD) <Required />
            </label>
            <input
              {...register("price", { required: true })}
              type="number"
              step="0.01"
              placeholder="0.00"
              className={`${inputClass} ${errors.price ? "border-red-400" : ""}`}
            />
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="mt-5 w-full bg-accent hover:bg-accent-dark text-white font-bold uppercase tracking-wide text-sm rounded-sm py-3 disabled:opacity-50"
          >
            {mutation.isPending ? "Creating listing..." : "Create listing"}
          </button>
        </section>
      </form>
    </div>
  );
}

type SellTab = "single" | "batch";

const SELL_TABS: { key: SellTab; label: string }[] = [
  { key: "single", label: "List a coin for sale" },
  { key: "batch", label: "Batch upload" },
];

export function SellPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: SellTab = searchParams.get("tab") === "batch" ? "batch" : "single";

  return (
    <div>
      <div className="flex gap-6 border-b border-gray-200 mb-6 max-sm:gap-4">
        {SELL_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSearchParams(key === "batch" ? { tab: "batch" } : {})}
            className={`-mb-px pb-3 text-lg font-bold border-b-2 max-sm:text-base max-sm:text-left transition-colors ${
              tab === key ? "text-gray-900 border-accent" : "text-gray-400 border-transparent hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "single" ? <SingleListingForm /> : <BatchImport />}
    </div>
  );
}
