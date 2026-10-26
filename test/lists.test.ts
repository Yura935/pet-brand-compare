import assert from "node:assert/strict";
import test from "node:test";
import { isPethouseProductUrl, parsePetslikeBrands, parsePethouseBrands, petslikeProductUrls } from "../src/lists.js";

test("картка Pethouse має шість частин шляху, категорія ні", () => {
  assert.equal(
    isPethouseProductUrl("https://pethouse.ua/ua/shop/sobakam/suhoi-korm/acana/acana-adult-dog/"),
    true,
  );
  assert.equal(isPethouseProductUrl("https://pethouse.ua/ua/shop/sobakam/suhoi-korm/acana/"), false);
  assert.equal(isPethouseProductUrl("https://pethouse.ua/ru/shop/sobakam/suhoi-korm/acana/acana-adult-dog/"), false);
});

test("сторінки брендів віддають назви без повторів", () => {
  const petslike = `
    <a href="/brand">Бренди</a>
    <a href="/brand/royalcanin">Royal Canin</a>
    <a href="https://petslike.ua/brand/royalcanin">Royal Canin</a>`;
  const pethouse = `
    <a href="/ua/brand/">Бренди</a>
    <a href="/ua/brand/acana/">Acana</a>`;
  assert.deepEqual(parsePetslikeBrands(petslike), ["Royal Canin"]);
  assert.deepEqual(parsePethouseBrands(pethouse), ["Acana"]);
});

test("список Petslike не бере російські адреси і категорії", () => {
  const urls = petslikeProductUrls([
    "https://petslike.ua/royal-canin",
    "https://petslike.ua/ru/royal-canin",
    "https://petslike.ua/category/sobaki",
  ]);
  assert.deepEqual(urls, ["https://petslike.ua/royal-canin"]);
});
