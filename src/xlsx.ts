import ExcelJS from "exceljs";
import type { Worksheet } from "exceljs";
import { cellValue } from "./brands.js";
import type { BrandRow, CardStatus, Issue, Site } from "./types.js";

const STATUSES: Array<[CardStatus, string]> = [
  ["inStock", "к-сть в наявності"],
  ["outOfStock", "к-сть нема в наявності"],
  ["discontinued", "знято"],
];

// Записує підсумок брендів у xlsx у формі двох блоків магазинів.
export async function writeWorkbook(rows: BrandRow[], filePath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Аркуш1");
  rows.forEach((row, index) => {
    sheet.getCell(1, index + 3).value = row.title;
  });
  writeBlock(sheet, rows, "petslike", 2);
  writeBlock(sheet, rows, "pethouse", 6);
  await workbook.xlsx.writeFile(filePath);
}

// Збирає таблицю Issues: тип, статус із журналу і посилання на товар.
export async function issuesWorkbook(issues: Issue[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Issues");
  sheet.getCell(1, 1).value = "Type";
  sheet.getCell(1, 2).value = "Статус";
  sheet.getCell(1, 3).value = "Товар";
  issues.forEach((issue, index) => {
    const row = index + 2;
    sheet.getCell(row, 1).value = issue.level;
    sheet.getCell(row, 2).value = issue.status;
    const product = sheet.getCell(row, 3);
    product.value = issue.url ? { text: issue.url, hyperlink: issue.url } : issue.message;
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// Пише назву магазину і три рядки статусів, починаючи з заданого рядка.
function writeBlock(sheet: Worksheet, rows: BrandRow[], site: Site, startRow: number): void {
  sheet.getCell(startRow, 2).value = site;
  STATUSES.forEach(([status, label], offset) => {
    const rowNumber = startRow + 1 + offset;
    sheet.getCell(rowNumber, 2).value = label;
    rows.forEach((row, index) => {
      sheet.getCell(rowNumber, index + 3).value = cellValue(row, site, status);
    });
  });
}
