import assert from "node:assert/strict";
import test from "node:test";
import { hasRussian, pageText, productPhotoUrl, russianHit } from "../src/russian.js";

test("український опис не вважається російською", () => {
  assert.equal(hasRussian("Корм для собак із куркою та рисом для дорослих собак"), false);
  assert.equal(hasRussian("Це якісний корм для котів"), false);
  assert.equal(hasRussian("Забезпечує хороший стан шкіри та шерсті"), false);
  assert.equal(hasRussian("Котята їдять корм"), false);
});

test("російське слово або літера помічаються", () => {
  assert.equal(hasRussian("Это хороший корм для собак"), true);
  assert.equal(hasRussian("Сухой корм для кошек"), true);
  assert.equal(hasRussian("Белый корм"), true);
  assert.equal(hasRussian("Хорошая еда для собак"), true);
  assert.equal(hasRussian("Вес собаки, кг"), true);
});

test("фрагмент показує початок речення з російським словом", () => {
  const hit = russianHit("Корм для собак. Это хороший корм для кошек на каждый день.");
  assert.equal(hit?.word, "Это");
  assert.equal(hit?.snippet.startsWith("Это хороший"), true);
});

test("фрагмент не починається всередині слова", () => {
  const hit = russianHit(`${"а".repeat(80)} Это хороший корм для собак`);
  assert.equal(hit?.snippet.startsWith("…Это хороший"), true);
});

test("текст сторінки береться без скриптів і без коментарів", () => {
  const html = "<html><body><script>это скрипт</script><p>Корм для собак</p><div class=\"comments\">Это хороший корм</div><div data-tab-content=\"reviews\">что купила этот корм</div></body></html>";
  assert.equal(hasRussian(pageText(html)), false);
});

test("російська в описі лишається, навіть якщо коментар теж російською", () => {
  const html = "<html><body><p>Сухой корм для кошек</p><div class=\"comments\">Это хороший корм</div></body></html>";
  assert.equal(russianHit(pageText(html))?.word, "кошек");
});

test("головне фото не є мініатюрою і не є фасовкою", () => {
  const html = `
    <meta property="og:image" content="https://pethouse.ua/assets/images/prods/small/royalcanin/000000299.jpg" />
    <img src="https://pethouse.ua/assets/images/prods/packing/3801.jpg" />
    <img src="https://pethouse.ua/assets/images/prods/royalcanin/0000002991.jpg" />
  `;
  assert.equal(
    productPhotoUrl(html, "https://pethouse.ua/ua/shop/item"),
    "https://pethouse.ua/assets/images/prods/royalcanin/0000002991.jpg",
  );
});

test("фото Petslike береться з картки товару", () => {
  const html = `<div class="product"><img src="/uploads/pack.jpg" /></div>`;
  assert.equal(productPhotoUrl(html, "https://petslike.ua/korm"), "https://petslike.ua/uploads/pack.jpg");
});
