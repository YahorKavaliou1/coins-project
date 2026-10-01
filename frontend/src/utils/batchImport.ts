import type { CoinBatchItem, Country, Metal } from "../types";
import { isWebUrl } from "./url";

/* ------------------------------------------------------------------ */
/* Target fields                                                        */
/* ------------------------------------------------------------------ */

export type FieldKey =
  | "country"
  | "year"
  | "denomination"
  | "metal"
  | "composition"
  | "weight"
  | "weight_unit"
  | "diameter"
  | "grade"
  | "category"
  | "sku"
  | "source_url"
  | "catalog_number"
  | "mintage"
  | "extra_info"
  | "price";

export type WeightUnit = "oz" | "g" | "kg";
export const WEIGHT_UNITS: WeightUnit[] = ["oz", "g", "kg"];

export interface FieldDef {
  key: FieldKey;
  label: string;
  required: boolean;
  /** Normalized header names that map to this field (see normalizeHeader). */
  synonyms: string[];
}

export const FIELDS: FieldDef[] = [
  { key: "country", label: "Country", required: true, synonyms: ["country", "страна", "issuer", "эмитент", "state", "государство"] },
  { key: "year", label: "Year", required: true, synonyms: ["year", "год", "годвыпуска", "date", "дата"] },
  { key: "denomination", label: "Denomination", required: false, synonyms: ["denomination", "номинал", "facevalue", "value"] },
  { key: "metal", label: "Metal", required: true, synonyms: ["metal", "металл", "material", "материал"] },
  { key: "composition", label: "Composition", required: false, synonyms: ["composition", "состав", "fineness", "проба", "purity"] },
  { key: "weight_unit", label: "Weight unit", required: false, synonyms: ["weightunit", "unit", "units", "единица", "единицаизмерения", "ед", "едизм"] },
  { key: "weight", label: "Weight", required: true, synonyms: ["weight", "вес", "масса"] },
  { key: "diameter", label: "Diameter (mm)", required: false, synonyms: ["diameter", "диаметр", "diametermm", "size"] },
  { key: "grade", label: "Grade", required: false, synonyms: ["grade", "состояние", "сохранность", "condition"] },
  { key: "sku", label: "SKU", required: false, synonyms: ["sku", "article", "articleno", "articlenumber", "артикул", "art", "itemno", "itemnumber", "stockno", "stocknumber", "инвентарныйномер"] },
  { key: "source_url", label: "Source link", required: false, synonyms: ["source", "sourceurl", "sourcelink", "link", "url", "ссылка", "источник", "numista", "ucoin"] },
  { key: "category", label: "Category", required: false, synonyms: ["category", "категория", "group", "группа", "series", "серия"] },
  { key: "catalog_number", label: "Catalog No.", required: false, synonyms: ["catalognumber", "catalogno", "catalog", "каталог", "номерпокаталогу", "km", "kmnumber"] },
  { key: "mintage", label: "Mintage", required: false, synonyms: ["mintage", "тираж"] },
  { key: "extra_info", label: "Extra info", required: false, synonyms: ["extrainfo", "extra", "description", "описание", "notes", "note", "comment", "comments", "комментарий", "примечание", "info", "name", "название"] },
  { key: "price", label: "Price (USD)", required: true, synonyms: ["price", "цена", "стоимость", "cost", "priceusd", "usd"] },
];

const PHOTO_SYNONYMS = ["photo", "photos", "фото", "фотография", "image", "images", "изображение", "picture", "pic", "file", "файл"];

export type Mapping = Record<FieldKey, number | null> & {
  /** Several columns may hold photo file names. */
  photos: number[];
};

export function emptyMapping(): Mapping {
  const mapping = { photos: [] } as unknown as Mapping;
  for (const field of FIELDS) mapping[field.key] = null;
  return mapping;
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Suggests a column for every field by header name: exact synonym first, then partial. */
export function autoMap(columns: string[]): Mapping {
  const mapping = emptyMapping();
  const used = new Set<number>();
  const normalized = columns.map(normalizeHeader);

  const assign = (matches: (header: string, synonym: string) => boolean) => {
    for (const field of FIELDS) {
      if (mapping[field.key] !== null) continue;
      const index = normalized.findIndex(
        (header, i) => !used.has(i) && header && field.synonyms.some((syn) => matches(header, syn))
      );
      if (index !== -1) {
        mapping[field.key] = index;
        used.add(index);
      }
    }
  };
  assign((header, syn) => header === syn);
  assign((header, syn) => syn.length >= 3 && header.includes(syn));

  normalized.forEach((header, i) => {
    if (!used.has(i) && PHOTO_SYNONYMS.some((syn) => header === syn || header.startsWith(syn))) {
      mapping.photos.push(i);
    }
  });
  return mapping;
}

/* ------------------------------------------------------------------ */
/* Draft rows                                                           */
/* ------------------------------------------------------------------ */

export type DraftValues = Record<Exclude<FieldKey, "country" | "metal">, string>;

export interface DraftRow {
  id: number;
  /** 1-based row number in the source table, for error messages. */
  sourceRow: number;
  values: DraftValues;
  countryId: number | null;
  /** Original text when it didn't match any country (shown to help the user). */
  countryText: string;
  metalId: number | null;
  metalText: string;
  /** Photo file names separated by ";". */
  photos: string;
}

const norm = (s: string) => s.trim().toLowerCase();

function findCountry(text: string, countries: Country[]): number | null {
  const t = norm(text);
  if (!t) return null;
  return countries.find((c) => norm(c.name) === t || (c.code && norm(c.code) === t))?.id ?? null;
}

function findMetal(text: string, metals: Metal[]): number | null {
  const t = norm(text);
  if (!t) return null;
  return metals.find((m) => norm(m.name) === t)?.id ?? null;
}

export function normalizeWeightUnit(text: string): WeightUnit | null {
  const t = norm(text).replace(/\.$/, "");
  if (["oz", "ozt", "ounce", "ounces", "унц", "унция", "унции", "тройская унция"].includes(t)) return "oz";
  if (["g", "gr", "gram", "grams", "г", "гр", "грамм", "граммы"].includes(t)) return "g";
  if (["kg", "kilogram", "kilograms", "кг", "килограмм"].includes(t)) return "kg";
  return null;
}

/** "1 234,50 $" (also with a non-breaking space) -> 1234.5; returns null for empty, NaN for garbage. */
export function parseNumber(text: string): number | null {
  const cleaned = text.replace(/[\s\u00a0$€£₽]/g, "").replace(",", ".");
  if (!cleaned) return null;
  return /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : NaN;
}

export function splitPhotoNames(text: string): string[] {
  return text
    .split(/[;,\n|]+/)
    .map((name) => name.trim().split(/[\\/]/).pop() ?? "")
    .filter(Boolean);
}

export function buildDraftRows(
  rows: string[][],
  mapping: Mapping,
  defaultUnit: WeightUnit,
  countries: Country[],
  metals: Metal[]
): DraftRow[] {
  const cell = (row: string[], key: FieldKey) => {
    const index = mapping[key];
    return index === null ? "" : (row[index] ?? "").trim();
  };

  return rows.map((row, i) => {
    let weight = cell(row, "weight");
    let unit = cell(row, "weight_unit");
    // "31.1 g" in the weight column: split value and unit if no unit column is mapped.
    const inline = weight.match(/^([\d\s.,]+)\s*([^\d\s.,]+.*)$/);
    if (inline && !unit) {
      weight = inline[1].trim();
      unit = inline[2];
    }
    const resolvedUnit = unit ? normalizeWeightUnit(unit) ?? unit : defaultUnit;

    const countryText = cell(row, "country");
    const metalText = cell(row, "metal");
    return {
      id: i,
      sourceRow: i + 2, // +1 for the header, +1 for 1-based numbering
      values: {
        year: cell(row, "year"),
        denomination: cell(row, "denomination"),
        composition: cell(row, "composition"),
        weight,
        weight_unit: resolvedUnit,
        diameter: cell(row, "diameter"),
        grade: cell(row, "grade"),
        category: cell(row, "category"),
        sku: cell(row, "sku"),
        source_url: cell(row, "source_url"),
        catalog_number: cell(row, "catalog_number"),
        mintage: cell(row, "mintage"),
        extra_info: cell(row, "extra_info"),
        price: cell(row, "price"),
      },
      countryId: findCountry(countryText, countries),
      countryText,
      metalId: findMetal(metalText, metals),
      metalText,
      photos: mapping.photos.flatMap((index) => splitPhotoNames(row[index] ?? "")).join("; "),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Photos                                                               */
/* ------------------------------------------------------------------ */

export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/** Photo files indexed by lower-cased file name. */
export type PhotoIndex = Map<string, File>;

export function buildPhotoIndex(files: File[]): PhotoIndex {
  const index: PhotoIndex = new Map();
  for (const file of files) index.set(file.name.toLowerCase(), file);
  return index;
}

export function isImageFileName(name: string): boolean {
  return /\.(jpe?g|png|webp)$/i.test(name);
}

/* ------------------------------------------------------------------ */
/* Validation                                                           */
/* ------------------------------------------------------------------ */

export type RowErrors = Partial<Record<FieldKey | "photos", string>>;

export function validateRow(row: DraftRow, photos: PhotoIndex): RowErrors {
  const errors: RowErrors = {};
  const v = row.values;

  if (row.countryId === null) {
    errors.country = row.countryText ? `Unknown country "${row.countryText}"` : "Country is required";
  }
  if (row.metalId === null) {
    errors.metal = row.metalText ? `Unknown metal "${row.metalText}"` : "Metal is required";
  }

  const year = parseNumber(v.year);
  if (year === null) errors.year = "Year is required";
  else if (!Number.isInteger(year) || year < -1000 || year > 2100) errors.year = "Invalid year";

  const weight = parseNumber(v.weight);
  if (weight === null) errors.weight = "Weight is required";
  else if (Number.isNaN(weight) || weight <= 0) errors.weight = "Weight must be a positive number";

  if (!WEIGHT_UNITS.includes(v.weight_unit as WeightUnit)) errors.weight_unit = "Use oz, g or kg";

  const price = parseNumber(v.price);
  if (price === null) errors.price = "Price is required";
  else if (Number.isNaN(price) || price <= 0) errors.price = "Price must be a positive number";

  const diameter = parseNumber(v.diameter);
  if (diameter !== null && (Number.isNaN(diameter) || diameter <= 0)) errors.diameter = "Invalid diameter";

  const mintage = parseNumber(v.mintage);
  if (mintage !== null && (Number.isNaN(mintage) || !Number.isInteger(mintage) || mintage < 0)) {
    errors.mintage = "Mintage must be a whole number";
  }

  if (v.category.trim().length > 50) errors.category = "At most 50 characters";
  if (v.sku.trim().length > 100) errors.sku = "At most 100 characters";
  const sourceUrl = v.source_url.trim();
  if (sourceUrl && (!isWebUrl(sourceUrl) || sourceUrl.length > 500)) {
    errors.source_url = "Use a full web address starting with https://";
  }

  const photoProblems: string[] = [];
  for (const name of splitPhotoNames(row.photos)) {
    const file = photos.get(name.toLowerCase());
    if (!file) photoProblems.push(`not found: ${name}`);
    else if (!ALLOWED_IMAGE_TYPES.has(file.type)) photoProblems.push(`unsupported format: ${name}`);
    else if (file.size > MAX_IMAGE_SIZE_BYTES) photoProblems.push(`larger than 5 MB: ${name}`);
  }
  if (photoProblems.length) errors.photos = `Photo ${photoProblems.join(", ")}`;

  return errors;
}

export function toBatchItem(row: DraftRow): CoinBatchItem {
  const v = row.values;
  const optionalText = (s: string) => s.trim() || null;
  const optionalNumber = (s: string) => parseNumber(s);
  return {
    country_id: row.countryId!,
    metal_id: row.metalId!,
    year: parseNumber(v.year)!,
    weight: parseNumber(v.weight)!,
    weight_unit: v.weight_unit as WeightUnit,
    price: parseNumber(v.price)!,
    denomination: optionalText(v.denomination),
    composition: optionalText(v.composition),
    diameter: optionalNumber(v.diameter),
    grade: optionalText(v.grade),
    category: optionalText(v.category),
    sku: optionalText(v.sku),
    source_url: optionalText(v.source_url),
    catalog_number: optionalText(v.catalog_number),
    mintage: optionalNumber(v.mintage),
    extra_info: optionalText(v.extra_info),
  };
}
