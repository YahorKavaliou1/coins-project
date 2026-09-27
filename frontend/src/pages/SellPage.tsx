import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { listCountries, listMetals } from "../api/reference";
import { createCoin, uploadCoinImage } from "../api/coins";
import type { CoinCreatePayload } from "../types";

interface FormValues extends Omit<CoinCreatePayload, "country_id" | "metal_id"> {
  country_id: string;
  metal_id: string;
}

export function SellPage() {
  const [files, setFiles] = useState<File[]>([]);
  const { data: countries } = useQuery({ queryKey: ["countries"], queryFn: listCountries });
  const { data: metals } = useQuery({ queryKey: ["metals"], queryFn: listMetals });

  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { weight_unit: "oz" },
  });

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
      alert("Coin listed successfully.");
    },
    onError: (err: any) => {
      alert(`Error: ${JSON.stringify(err.response?.data)}`);
    },
  });

  const currentCountries = countries?.filter((c) => !c.is_historical) ?? [];
  const historicalCountries = countries?.filter((c) => c.is_historical) ?? [];
  const regions = [...new Set(currentCountries.map((c) => c.region ?? "Other"))].sort();

  return (
    <div className="bg-white p-4 rounded-lg shadow max-w-lg">
      <h2 className="font-semibold mb-3">Add coin (list for sale)</h2>
      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="flex flex-col gap-2">
        <select {...register("country_id", { required: true })} className="border rounded p-2">
          <option value="">Country</option>
          {regions.map((region) => (
            <optgroup key={region} label={region}>
              {currentCountries
                .filter((c) => (c.region ?? "Other") === region)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
          ))}
          {historicalCountries.length > 0 && (
            <optgroup label="Historical / defunct">
              {historicalCountries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        <input {...register("denomination")} placeholder="Denomination (optional, e.g. 1 Dollar)" className="border rounded p-2" />
        <input {...register("year", { required: true })} type="number" placeholder="Year" className="border rounded p-2" />

        <select {...register("metal_id", { required: true })} className="border rounded p-2">
          <option value="">Metal</option>
          {metals?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <input {...register("weight", { required: true })} type="number" step="0.01" placeholder="Weight" className="border rounded p-2 flex-1" />
          <select {...register("weight_unit")} className="border rounded p-2">
            <option value="oz">oz</option>
            <option value="g">g</option>
            <option value="kg">kg</option>
          </select>
        </div>

        <input {...register("composition")} placeholder="Composition (optional, e.g. 92.5% Ag, 7.5% Cu)" className="border rounded p-2" />
        <input {...register("diameter")} type="number" step="0.01" placeholder="Diameter (mm, optional)" className="border rounded p-2" />
        <input {...register("mintage")} type="number" placeholder="Mintage (optional)" className="border rounded p-2" />
        <input {...register("grade")} placeholder="Grade (optional, e.g. MS-65, XF-40)" className="border rounded p-2" />
        <input {...register("catalog_number")} placeholder="Catalog No. (optional, e.g. KM# 123)" className="border rounded p-2" />
        <input {...register("extra_info")} placeholder="Extra info (e.g. Walking Liberty)" className="border rounded p-2" />
        <input {...register("price", { required: true })} type="number" step="0.01" placeholder="Price (USD)" className="border rounded p-2" />

        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="text-sm"
        />

        <button type="submit" className="bg-brand text-white rounded p-2 mt-2">
          Create listing
        </button>
      </form>
    </div>
  );
}
