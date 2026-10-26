import assert from "node:assert/strict";
import test from "node:test";
import { classifyPetslike, classifyPethouse } from "../src/classify.js";

test("Petslike зі змішаними фасовками є в наявності", () => {
  const html = `
    <div class="product">
      <div>Бренд: Royal Canin</div>
      <div class="product__offer"><a class="js-product-offer-buy">В кошик</a></div>
      <div class="product__offer"><a class="js-product-offer-buy" style="display: none">В кошик</a></div>
    </div>`;
  assert.deepEqual(classifyPetslike(html), { brand: "Royal Canin", status: "inStock" });
});

test("Petslike без жодної доступної фасовки немає в наявності", () => {
  const html = `
    <div class="product">
      <div>Бренд: Royal Canin</div>
      <div class="product__offer"><a class="js-product-offer-buy" style="display: none">В кошик</a></div>
    </div>`;
  assert.deepEqual(classifyPetslike(html), { brand: "Royal Canin", status: "outOfStock" });
});

test("Petslike бере бренд із заголовка, якщо рядка Бренд немає", () => {
  const html = `
    <div class="product">
      <h1>WestVet Корисна вода для котів «АкваCats»</h1>
    </div>`;
  assert.equal(classifyPetslike(html, ["West Paw", "WestVet"]).brand, "WestVet");
});

test("Petslike відрізає вік і країну від назви бренду", () => {
  const html = `
    <div class="product">
      <div>Бренд: 1st Choice Вік: Для дорослих котів Країна: Канада</div>
      <div class="product__offer"><a class="js-product-offer-buy">В кошик</a></div>
    </div>`;
  assert.deepEqual(classifyPetslike(html), { brand: "1st Choice", status: "inStock" });
});

test("Petslike відрізає характеристику, прилиплу до бренду без пробілу", () => {
  const html = `
    <div class="product">
      <div>Бренд: ПриродаВік: Для дорослих собак Країна: Україна</div>
    </div>`;
  assert.equal(classifyPetslike(html).brand, "Природа");
});

test("Petslike з міткою знятий з виробництва є знятим", () => {
  const html = `
    <div class="product">
      <div>Бренд: Royal Canin</div>
      <p>Товар знятий з виробництва</p>
      <div class="product__offer"><a class="js-product-offer-buy">В кошик</a></div>
    </div>`;
  assert.deepEqual(classifyPetslike(html), { brand: "Royal Canin", status: "discontinued" });
});

test("Pethouse з наявною пропозицією є в наявності", () => {
  const html = `
    <html><body>
      <script type="application/ld+json">
        {"@type":"Product","brand":{"@type":"Brand","name":"Acana"},"offers":{"offers":[
          {"@type":"Offer","availability":"https://schema.org/InStock"},
          {"@type":"Offer","availability":"https://schema.org/OutOfStock"}
        ]}}
      </script>
    </body></html>`;
  assert.deepEqual(classifyPethouse(html), { brand: "Acana", status: "inStock" });
});

test("Pethouse з банером знятий з продажу є знятим", () => {
  const html = `
    <html><body>
      <script>{"product_out":"Товар знятий з продажу"}</script>
      <div>Товар знятий з продажу. Замість нього виготовляється:</div>
      <script type="application/ld+json">
        {"@type":"Product","brand":{"@type":"Brand","name":"Carnilove"},"offers":{"availability":"https://schema.org/OutOfStock"}}
      </script>
      <h2>Схожі товари в наявності</h2>
    </body></html>`;
  assert.deepEqual(classifyPethouse(html), { brand: "Carnilove", status: "discontinued" });
});

test("словник перекладів Pethouse сам по собі не знімає товар", () => {
  const html = `
    <html><body>
      <script>{"product_out":"Товар знятий з продажу"}</script>
      <script type="application/ld+json">
        {"@type":"Product","brand":{"@type":"Brand","name":"Acana"},"offers":{"availability":"https://schema.org/OutOfStock"}}
      </script>
    </body></html>`;
  assert.deepEqual(classifyPethouse(html), { brand: "Acana", status: "outOfStock" });
});
