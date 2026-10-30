import assert from "node:assert/strict";
import test from "node:test";
import { isChallenge, MissingPageError } from "../src/browser.js";

test("відсутня сторінка відрізняється від тимчасової помилки", () => {
  const missing = new MissingPageError("https://petslike.ua/gone");
  assert.equal(missing instanceof MissingPageError, true);
  assert.equal(new Error("мережа") instanceof MissingPageError, false);
});

test("сторінка перевірки відрізняється від картки товару", () => {
  assert.equal(isChallenge("<title>Just a moment...</title>"), true);
  assert.equal(isChallenge("<title>Трохи зачекайте…</title><p>Підтвердьте, що ви людина</p>"), true);
  assert.equal(isChallenge("<title>Триває перевірка безпеки</title>"), true);
  assert.equal(isChallenge("<h1>Brit Care корм для собак</h1>"), false);
});
