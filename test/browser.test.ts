import assert from "node:assert/strict";
import test from "node:test";
import { MissingPageError } from "../src/browser.js";

test("відсутня сторінка відрізняється від тимчасової помилки", () => {
  const missing = new MissingPageError("https://petslike.ua/gone");
  assert.equal(missing instanceof MissingPageError, true);
  assert.equal(new Error("мережа") instanceof MissingPageError, false);
});
