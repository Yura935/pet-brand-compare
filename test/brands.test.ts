import assert from "node:assert/strict";
import test from "node:test";
import { addCard, brandFromTitle, brandKey, buildRows, cellValue, mergeRows } from "../src/brands.js";
import type { AliasGroup } from "../src/types.js";

const groups: AliasGroup[] = [{ names: ["Клуб 4 Лапи", "Club 4 Paws"], title: "Club 4 Paws" }];

test("однаковий кириличний бренд дає один ключ", () => {
  assert.equal(brandKey("Акана"), brandKey("акана"));
  assert.equal(brandKey("Hill's"), brandKey("Hills"));
});

test("Клуб 4 Лапи і Club 4 Paws стають однією колонкою", () => {
  const rows = buildRows(
    { petslike: ["Club 4 Paws"], pethouse: ["Клуб 4 Лапи", "Acana"] },
    groups,
  );
  const club = rows.find((row) => row.title === "Club 4 Paws");
  assert.ok(club);
  assert.equal(club.petslike.onSite, true);
  assert.equal(club.pethouse.onSite, true);
  assert.equal(cellValue(club, "petslike", "inStock"), 0);
  const acana = rows.find((row) => row.title === "Acana");
  assert.ok(acana);
  assert.equal(cellValue(acana, "petslike", "inStock"), "Null");
  assert.equal(cellValue(acana, "pethouse", "outOfStock"), 0);
});

test("картка додається в лічильник свого статусу", () => {
  const rows = buildRows({ petslike: ["Royal Canin"], pethouse: [] }, groups);
  addCard(rows, "petslike", "Royal Canin", "inStock", groups);
  const row = rows.find((item) => item.title === "Royal Canin");
  assert.ok(row);
  assert.equal(cellValue(row, "petslike", "inStock"), 1);
  assert.equal(cellValue(row, "pethouse", "inStock"), "Null");
});

test("з заголовка береться найдовший бренд довідника", () => {
  assert.equal(brandFromTitle("Home Food For DOG М’ясний топінг", ["Home", "Home Food"]), "Home Food");
  assert.equal(brandFromTitle("ProVET SaniPet Відлякувач", ["Pro", "ProVET"]), "ProVET");
  assert.equal(brandFromTitle("з яловичиною, птицею і овочами", ["Espree"]), "");
});

test("картка з віком і країною додається до бренду без цих параметрів", () => {
  const rows = buildRows({ petslike: ["1st Choice"], pethouse: [] }, []);
  addCard(rows, "petslike", "1st Choice Вік: Для дорослих котів Країна: Канада", "outOfStock", []);
  const row = rows.find((item) => item.title === "1st Choice");
  assert.ok(row);
  assert.equal(cellValue(row, "petslike", "outOfStock"), 1);
  assert.equal(rows.some((item) => item.title.includes("Вік")), false);
});

test("уже зібрані дублі з характеристиками зливаються в один бренд", () => {
  const rows = buildRows({ petslike: ["Beaphar"], pethouse: [] }, []);
  addCard(rows, "petslike", "Beaphar", "inStock", []);
  rows.push({
    key: "dirty",
    title: "Beaphar Вік: Для дорослих котів Країна: Нідерланди Специфіка: Гіпоалергенний",
    petslikeName: null,
    pethouseName: null,
    petslike: { onSite: true, inStock: 0, outOfStock: 3, discontinued: 0 },
    pethouse: { onSite: false, inStock: 0, outOfStock: 0, discontinued: 0 },
  });
  const merged = mergeRows(rows, []);
  const row = merged.find((item) => item.title === "Beaphar");
  assert.equal(merged.length, 1);
  assert.ok(row);
  assert.equal(row.petslike.inStock, 1);
  assert.equal(row.petslike.outOfStock, 3);
});
