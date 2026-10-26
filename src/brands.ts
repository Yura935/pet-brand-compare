import fs from "node:fs";
import type { AliasGroup, BrandRow, CardStatus, Catalog, Site, SiteCounts } from "./types.js";

const LETTERS: Array<[string, string]> = [
  ["щ", "shch"],
  ["ж", "zh"],
  ["х", "kh"],
  ["ц", "ts"],
  ["ч", "ch"],
  ["ш", "sh"],
  ["є", "ye"],
  ["ї", "yi"],
  ["ю", "yu"],
  ["я", "ya"],
  ["а", "a"],
  ["б", "b"],
  ["в", "v"],
  ["г", "h"],
  ["ґ", "g"],
  ["д", "d"],
  ["е", "e"],
  ["и", "y"],
  ["і", "i"],
  ["й", "y"],
  ["к", "k"],
  ["л", "l"],
  ["м", "m"],
  ["н", "n"],
  ["о", "o"],
  ["п", "p"],
  ["р", "r"],
  ["с", "s"],
  ["т", "t"],
  ["у", "u"],
  ["ф", "f"],
  ["ь", ""],
  ["ъ", ""],
  ["ы", "y"],
  ["э", "e"],
  ["ё", "yo"],
];

// Прибирає пробіли й розділові знаки і перекладає кирилицю в латиницю.
export function brandKey(name: string): string {
  const compact = String(name).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  let result = "";
  for (let index = 0; index < compact.length; index += 1) {
    const pair = LETTERS.find(([letter]) => compact.startsWith(letter, index));
    if (pair) {
      result += pair[1];
      index += pair[0].length - 1;
    } else {
      result += compact[index];
    }
  }
  return result;
}

// Читає список псевдонімів брендів з json-файлу.
export function loadAliases(filePath: string): AliasGroup[] {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as { groups?: AliasGroup[] };
  return data.groups || [];
}

// Повертає групу псевдонімів, якщо назва входить до неї.
export function aliasGroup(name: string, groups: AliasGroup[]): AliasGroup | null {
  const key = brandKey(name);
  return groups.find((group) => group.names.some((item) => brandKey(item) === key)) || null;
}

// Повертає стабільний ключ колонки для назви бренду.
export function columnKey(name: string, groups: AliasGroup[]): string {
  const group = aliasGroup(name, groups);
  return group ? `alias:${brandKey(group.title)}` : brandKey(name);
}

const BRAND_LABELS = [
  "Розмір породи",
  "Клас продукту",
  "Тип корму",
  "Форма випуску",
  "Специфіка",
  "Призначення",
  "Особливості",
  "Країна",
  "Лінійка",
  "Серія",
  "Смак",
  "Вік",
  "Вид",
  "Вага",
  "Об'єм",
];

// Шукає відомий бренд на початку заголовка картки і повертає назву з довідника.
export function brandFromTitle(title: string, names: string[]): string {
  const text = title.replace(/\s+/g, " ").trim().toLowerCase();
  const ranked = names.filter(Boolean).sort((left, right) => right.length - left.length);
  for (const name of ranked) {
    const needle = name.toLowerCase();
    if (!text.startsWith(needle)) continue;
    const next = text[needle.length] || "";
    if (next && /[\p{L}\p{N}]/u.test(next)) continue;
    return name;
  }
  return "";
}

// Прибирає з назви бренду вік, країну та інші характеристики картки.
export function cleanBrandName(name: string): string {
  const value = name.replace(/^Бренд:\s*/, "").split(/\s+В кошик|\s+Товар/)[0]?.trim() || "";
  const cutAt = BRAND_LABELS.reduce((nearest, label) => {
    const index = value.indexOf(label);
    return index > 0 && index < nearest ? index : nearest;
  }, value.length);
  return value.slice(0, cutAt).trim();
}

function blankSite(): SiteCounts {
  return { onSite: false, inStock: 0, outOfStock: 0, discontinued: 0 };
}

function addSiteCounts(left: SiteCounts, right: SiteCounts): SiteCounts {
  return {
    onSite: left.onSite || right.onSite,
    inStock: left.inStock + right.inStock,
    outOfStock: left.outOfStock + right.outOfStock,
    discontinued: left.discontinued + right.discontinued,
  };
}

function emptyRow(key: string, title: string): BrandRow {
  return {
    key,
    title,
    petslikeName: null,
    pethouseName: null,
    petslike: blankSite(),
    pethouse: blankSite(),
  };
}

// Збирає рядки таблиці з двох довідників брендів.
export function buildRows(catalog: Catalog, groups: AliasGroup[]): BrandRow[] {
  const rows = new Map<string, BrandRow>();
  for (const site of ["petslike", "pethouse"] as const) {
    for (const name of catalog[site]) {
      const key = columnKey(name, groups);
      const row = rows.get(key) || emptyRow(key, name);
      rows.set(key, row);
      row[site].onSite = true;
      row[`${site}Name`] = name;
    }
  }
  for (const row of rows.values()) {
    const group = aliasGroup(row.petslikeName || row.pethouseName || row.title, groups);
    if (group) row.title = group.title;
    else if (row.petslikeName) row.title = row.petslikeName;
    else if (row.pethouseName) row.title = row.pethouseName;
  }
  return [...rows.values()].sort((left, right) => left.title.localeCompare(right.title, "uk"));
}

// Повертає назви брендів одного сайту з довідника.
export function siteBrandNames(rows: BrandRow[], site: Site): string[] {
  return rows.flatMap((row) => {
    const name = site === "petslike" ? row.petslikeName : row.pethouseName;
    return name ? [name] : [];
  });
}

// Додає одну картку в лічильник бренду.
export function addCard(rows: BrandRow[], site: Site, brandName: string, status: CardStatus, groups: AliasGroup[]): BrandRow {
  const name = cleanBrandName(brandName);
  const key = columnKey(name, groups);
  let row = rows.find((item) => item.key === key);
  if (!row) {
    row = emptyRow(key, aliasGroup(name, groups)?.title || name);
    rows.push(row);
    rows.sort((left, right) => left.title.localeCompare(right.title, "uk"));
  }
  row[site].onSite = true;
  row[site][status] += 1;
  return row;
}

// Зливає рядки одного бренду, якщо до частини назв прилипли характеристики.
export function mergeRows(rows: BrandRow[], groups: AliasGroup[]): BrandRow[] {
  const merged = new Map<string, BrandRow>();
  for (const row of rows) {
    const title = cleanBrandName(row.title);
    const key = columnKey(title, groups);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, {
        ...row,
        key,
        title: aliasGroup(title, groups)?.title || title,
        petslike: { ...row.petslike },
        pethouse: { ...row.pethouse },
      });
      continue;
    }
    current.petslike = addSiteCounts(current.petslike, row.petslike);
    current.pethouse = addSiteCounts(current.pethouse, row.pethouse);
  }
  return [...merged.values()].sort((left, right) => left.title.localeCompare(right.title, "uk"));
}

// Повертає число або Null для однієї клітинки сайту.
export function cellValue(row: BrandRow, site: Site, status: CardStatus): number | "Null" {
  if (!row[site].onSite) return "Null";
  return row[site][status];
}
