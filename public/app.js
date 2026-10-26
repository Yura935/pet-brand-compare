const analyze = document.querySelector("#analyze");
const download = document.querySelector("#download");
const downloadIssues = document.querySelector("#download-issues");
const bar = document.querySelector("#bar");
const percent = document.querySelector("#percent");
const status = document.querySelector("#status");
const warning = document.querySelector("#warning");
const rows = document.querySelector("#rows");
const issues = document.querySelector("#issues");
const tabMain = document.querySelector("#tab-main");
const tabIssues = document.querySelector("#tab-issues");
const panelMain = document.querySelector("#panel-main");
const panelIssues = document.querySelector("#panel-issues");
const filterType = document.querySelector("#filter-type");
const filterStatus = document.querySelector("#filter-status");
const filterUrl = document.querySelector("#filter-url");
const sortButtons = document.querySelectorAll(".sort");
let latestIssues = [];
let issueSort = { key: "", dir: 1 };

filterType.addEventListener("change", renderIssues);
filterStatus.addEventListener("change", renderIssues);
filterUrl.addEventListener("input", renderIssues);
for (const button of sortButtons) {
  button.addEventListener("click", () => {
    const key = button.dataset.sort;
    issueSort = { key, dir: issueSort.key === key ? issueSort.dir * -1 : 1 };
    renderIssues();
  });
}

tabMain.addEventListener("click", () => selectTab("main"));
tabIssues.addEventListener("click", () => selectTab("issues"));

analyze.addEventListener("click", async () => {
  const path = analyze.dataset.mode === "continue" ? "/api/job/continue" : "/api/job/start";
  analyze.disabled = true;
  const response = await fetch(path, { method: "POST" });
  show(await response.json());
});

download.addEventListener("click", () => {
  if (!download.disabled) window.location = "/api/download";
});

downloadIssues.addEventListener("click", () => {
  if (!downloadIssues.disabled) window.location = "/api/download/issues";
});

// Малює стан збору на сторінці.
function show(job) {
  analyze.disabled = !job.analyzeEnabled;
  analyze.textContent = job.continueMode ? "Продовжити" : "Аналізувати сайти";
  analyze.dataset.mode = job.continueMode ? "continue" : "start";
  download.disabled = !job.downloadEnabled;
  const value = job.percent || 0;
  bar.style.width = `${value}%`;
  percent.textContent = `${value}%`;
  status.textContent = job.error || job.statusLine || "";
  warning.textContent = job.warning || "";
  rows.replaceChildren(...job.rows.map(rowView));
  latestIssues = job.issues || [];
  fillStatusFilter(latestIssues);
  renderIssues();
  tabIssues.textContent = latestIssues.length ? `Issues (${latestIssues.length})` : "Issues";
  downloadIssues.disabled = latestIssues.length === 0;
}

// Оновлює список статусів і лишає вже вибраний фільтр.
function fillStatusFilter(list) {
  const selected = filterStatus.value;
  const names = [...new Set(list.map((issue) => issue.status))].sort((a, b) => a.localeCompare(b, "uk"));
  filterStatus.replaceChildren(new Option("Усі", ""), ...names.map((name) => new Option(name, name)));
  filterStatus.value = names.includes(selected) ? selected : "";
}

// Показує Issues з урахуванням фільтрів і сортування.
function renderIssues() {
  const query = filterUrl.value.trim().toLowerCase();
  const visible = latestIssues.filter((issue) => {
    if (filterType.value && issue.level !== filterType.value) return false;
    if (filterStatus.value && issue.status !== filterStatus.value) return false;
    const product = `${issue.url} ${issue.message}`.toLowerCase();
    return !query || product.includes(query);
  });
  if (issueSort.key) {
    const key = issueSort.key;
    visible.sort((a, b) => String(a[key]).localeCompare(String(b[key]), "uk") * issueSort.dir);
  }
  issues.replaceChildren(...(visible.length ? visible.map(issueView) : [emptyIssues()]));
  for (const button of sortButtons) {
    const active = issueSort.key === button.dataset.sort;
    button.classList.toggle("active", active);
    const mark = active ? (issueSort.dir > 0 ? " ↑" : " ↓") : "";
    button.textContent = `${button.dataset.label}${mark}`;
  }
}

// Порожній рядок, коли фільтр нічого не лишив.
function emptyIssues() {
  const line = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 3;
  cell.textContent = "Нічого не знайдено";
  line.append(cell);
  return line;
}

// Перемикає видиму таблицю.
function selectTab(name) {
  const main = name === "main";
  tabMain.classList.toggle("active", main);
  tabIssues.classList.toggle("active", !main);
  panelMain.classList.toggle("hidden", !main);
  panelIssues.classList.toggle("hidden", main);
  tabMain.setAttribute("aria-selected", main ? "true" : "false");
  tabIssues.setAttribute("aria-selected", main ? "false" : "true");
}

// Будує один рядок таблиці бренду.
function rowView(row) {
  const line = document.createElement("tr");
  const cells = [
    row.title,
    row.petslike.inStock,
    row.petslike.outOfStock,
    row.petslike.discontinued,
    row.pethouse.inStock,
    row.pethouse.outOfStock,
    row.pethouse.discontinued,
  ];
  for (const value of cells) {
    const cell = document.createElement("td");
    cell.textContent = String(value);
    line.append(cell);
  }
  return line;
}

// Будує рядок зі статусом і посиланням на товар.
function issueView(issue) {
  const line = document.createElement("tr");
  const type = document.createElement("td");
  type.textContent = issue.level;
  type.className = issue.level === "error" ? "status-error" : "status-warn";
  const status = document.createElement("td");
  status.textContent = issue.status;
  const product = document.createElement("td");
  if (issue.url) {
    const link = document.createElement("a");
    link.href = issue.url;
    link.textContent = issue.url;
    link.target = "_blank";
    link.rel = "noopener";
    product.append(link);
  } else {
    product.textContent = issue.message;
  }
  line.append(type, status, product);
  return line;
}

async function poll() {
  const response = await fetch("/api/job");
  show(await response.json());
}

poll();
setInterval(poll, 1000);
