import assert from "node:assert/strict";
import test from "node:test";
import { hasRussian, pageText, productPhotoUrl } from "../src/russian.js";

test("український опис не вважається російською", () => {
  assert.equal(hasRussian("Корм для собак із куркою та рисом для дорослих собак"), false);
  assert.equal(hasRussian("Це якісний корм для котів"), false);
});

test("російське слово або літера помічаються", () => {
  assert.equal(hasRussian("Это хороший корм для собак"), true);
  assert.equal(hasRussian("Сухой корм для кошек"), true);
  assert.equal(hasRussian("Белый корм"), true);
});

test("текст сторінки береться без скриптів", () => {
  const html = "<html><body><script>это скрипт</script><p>Корм для собак</p></body></html>";
  assert.equal(hasRussian(pageText(html)), false);
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
