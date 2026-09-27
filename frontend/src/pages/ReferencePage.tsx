import { useQuery } from "@tanstack/react-query";
import { listCountries, listMetals } from "../api/reference";

export function ReferencePage() {
  const { data: countries } = useQuery({ queryKey: ["countries"], queryFn: listCountries });
  const { data: metals } = useQuery({ queryKey: ["metals"], queryFn: listMetals });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="font-semibold mb-2">Countries</h2>
        <ul className="text-sm space-y-1 max-h-96 overflow-y-auto">
          {countries?.map((c) => (
            <li key={c.id}>
              {c.name} ({c.code ?? "-"}) — {c.region ?? "Unknown"}
              {c.is_historical && " · historical"}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="font-semibold mb-2">Metals</h2>
        <ul className="text-sm space-y-1 max-h-96 overflow-y-auto">
          {metals?.map((m) => (
            <li key={m.id}>{m.name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
