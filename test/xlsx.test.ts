import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import ExcelJS from "exceljs";
import { buildRows } from "../src/brands.js";
import { issuesWorkbook, writeWorkbook } from "../src/xlsx.js";

test("xlsx має два блоки по три рядки і не містить e-zoo", async () => {
  const rows = buildRows(
    { petslike: ["Royal Canin"], pethouse: ["Acana"] },
    [],
  );
  const filePath = path.join(os.tmpdir(), `pet-brand-compare-${Date.now()}.xlsx`);
  await writeWorkbook(rows, filePath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.getWorksheet("Аркуш1");
  assert.ok(sheet);
  assert.equal(sheet.getCell("C1").value, "Acana");
  assert.equal(sheet.getCell("D1").value, "Royal Canin");
  assert.equal(sheet.getCell("B2").value, "petslike");
  assert.equal(sheet.getCell("B3").value, "к-сть в наявності");
  assert.equal(sheet.getCell("B4").value, "к-сть нема в наявності");
  assert.equal(sheet.getCell("B5").value, "знято");
  assert.equal(sheet.getCell("B6").value, "pethouse");
  assert.equal(sheet.getCell("B9").value, "знято");
  assert.equal(sheet.getCell("C3").value, "Null");
  assert.equal(sheet.getCell("C7").value, 0);
  assert.equal(sheet.getCell("D3").value, 0);
  assert.equal(sheet.getCell("D7").value, "Null");
  const values: string[] = [];
  sheet.eachRow((row) => row.eachCell((cell) => values.push(String(cell.value))));
  assert.equal(values.includes("e-zoo"), false);
  fs.unlinkSync(filePath);
});

test("xlsx Issues містить статус і посилання на товар", async () => {
  const body = await issuesWorkbook([
    { level: "warn", status: "Немає бренду", url: "https://petslike.ua/apple", message: "Немає бренду: https://petslike.ua/apple" },
    { level: "error", status: "Chrome не відкрився", url: "", message: "Chrome не відкрився" },
  ]);
  const filePath = path.join(os.tmpdir(), `pet-brand-issues-${Date.now()}.xlsx`);
  fs.writeFileSync(filePath, body);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.getWorksheet("Issues");
  assert.ok(sheet);
  assert.equal(sheet.getCell("A1").value, "Type");
  assert.equal(sheet.getCell("B1").value, "Статус");
  assert.equal(sheet.getCell("C1").value, "Товар");
  assert.equal(sheet.getCell("A2").value, "warn");
  assert.equal(sheet.getCell("B2").value, "Немає бренду");
  assert.deepEqual(sheet.getCell("C2").value, { text: "https://petslike.ua/apple", hyperlink: "https://petslike.ua/apple" });
  assert.equal(sheet.getCell("A3").value, "error");
  assert.equal(sheet.getCell("B3").value, "Chrome не відкрився");
  fs.unlinkSync(filePath);
});
