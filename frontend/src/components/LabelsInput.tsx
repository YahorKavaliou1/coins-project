import { useId, useState } from "react";
import { X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getCoinFacets } from "../api/coins";
import { MAX_LABEL_LENGTH, MAX_LABELS, cleanLabels } from "../utils/labels";

interface LabelsInputProps {
  value: string[];
  onChange: (labels: string[]) => void;
}

/**
 * Tag input for a coin's labels: Enter or a comma adds the typed label, Backspace on an
 * empty field removes the last one. Suggests the labels already in use, so sellers reuse
 * "Proof" instead of creating "proof coin" and splitting the shop filter.
 */
export function LabelsInput({ value, onChange }: LabelsInputProps) {
  const [draft, setDraft] = useState("");
  const datalistId = useId();

  // Same query as CategoryDatalist: refreshed whenever coins are created, edited or deleted.
  const { data } = useQuery({
    queryKey: ["coin-facets", "unfiltered"],
    queryFn: () => getCoinFacets(),
  });
  const taken = new Set(value.map((l) => l.toLowerCase()));
  const suggestions = (data?.labels ?? []).filter((l) => !taken.has(l.name.toLowerCase()));

  const full = value.length >= MAX_LABELS;

  function add(text: string) {
    const label = text.trim();
    setDraft("");
    if (!label || full) return;
    // Reuse the spelling of an existing label ("proof" -> "Proof").
    const existing = suggestions.find((s) => s.name.toLowerCase() === label.toLowerCase());
    onChange(cleanLabels([...value, existing?.name ?? label]).slice(0, MAX_LABELS));
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="w-full flex flex-wrap items-center gap-1.5 border border-gray-300 rounded-sm px-2 py-1.5 focus-within:border-accent">
        {value.map((label, index) => (
          <span
            key={label}
            className="flex items-center gap-1 bg-accent/10 text-accent-dark text-xs font-medium rounded-full pl-2.5 pr-1 py-0.5"
          >
            {label}
            <button
              type="button"
              onClick={() => remove(index)}
              title={`Remove "${label}"`}
              className="rounded-full p-0.5 hover:bg-accent/20"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {!full && (
          <input
            value={draft}
            list={datalistId}
            maxLength={MAX_LABEL_LENGTH}
            autoComplete="off"
            placeholder={value.length === 0 ? "e.g. Proof, Low mintage" : "Add label"}
            onChange={(e) => {
              const text = e.target.value;
              const native = e.nativeEvent as InputEvent;
              // A picked datalist suggestion arrives as a replacement, not as typing.
              const picked =
                native.inputType === undefined || native.inputType === "insertReplacementText";
              if (text.includes(",")) add(text.replace(/,/g, ""));
              else if (picked && suggestions.some((s) => s.name === text)) add(text);
              else setDraft(text);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // not submit the form
                add(draft);
              } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
                remove(value.length - 1);
              }
            }}
            onBlur={() => add(draft)}
            className="flex-1 min-w-24 text-sm py-0.5 focus:outline-none"
          />
        )}
      </div>
      <datalist id={datalistId}>
        {suggestions.map((s) => (
          <option key={s.name} value={s.name} />
        ))}
      </datalist>
      <p className="text-xs text-gray-400 mt-1">
        {full
          ? `Maximum of ${MAX_LABELS} labels reached.`
          : `Up to ${MAX_LABELS} labels; press Enter or comma to add.`}
      </p>
    </div>
  );
}
